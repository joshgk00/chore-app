import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createRewardService, type RewardService } from '../../src/services/rewardService.js';
import { createActivityService, type ActivityService } from '../../src/services/activityService.js';
import { ConflictError, NotFoundError } from '../../src/lib/errors.js';
import { seedRewardData, seedPointsLedger } from '../helpers/seed-rewards.js';

const baseRequest = {
  rewardId: 1,
  idempotencyKey: 'test-key-1',
  localDate: '2026-03-15',
};

let db: Database.Database;
let activityService: ActivityService;
let service: RewardService;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRewardData(db);
  activityService = createActivityService(db);
  service = createRewardService(db, activityService);
});

afterEach(() => {
  db.close();
});

describe('rewardService', () => {
  describe('getActiveRewards', () => {
    it('returns only active rewards', () => {
      const rewards = service.getActiveRewards();

      expect(rewards).toHaveLength(2);
      expect(rewards.map((r) => r.id)).toEqual([1, 2]);
    });

    it('excludes archived rewards', () => {
      const rewards = service.getActiveRewards();
      const ids = rewards.map((r) => r.id);

      expect(ids).not.toContain(3);
    });

    it('returns correct fields', () => {
      const rewards = service.getActiveRewards();
      const reward = rewards.find((r) => r.id === 1)!;

      expect(reward.name).toBe('Extra Screen Time');
      expect(reward.pointsCost).toBe(20);
      expect(reward.sortOrder).toBe(1);
    });
  });

  describe('submitRequest', () => {
    it('creates request with correct cost_snapshot', () => {
      seedPointsLedger(db, 100);

      const request = service.submitRequest(baseRequest);

      expect(request.rewardId).toBe(1);
      expect(request.rewardNameSnapshot).toBe('Extra Screen Time');
      expect(request.costSnapshot).toBe(20);
      expect(request.status).toBe('pending');
      expect(request.localDate).toBe('2026-03-15');
      expect(request.idempotencyKey).toBe('test-key-1');
    });

    it('with sufficient points succeeds', () => {
      seedPointsLedger(db, 20);

      const request = service.submitRequest(baseRequest);

      expect(request.status).toBe('pending');
    });

    it('with insufficient available points returns ConflictError', () => {
      seedPointsLedger(db, 10);

      expect(() => service.submitRequest(baseRequest)).toThrow(ConflictError);
      expect(() =>
        service.submitRequest({ ...baseRequest, idempotencyKey: 'key-2' }),
      ).toThrow('insufficient_points');
    });

    it('after request, reserved increases by cost_snapshot', () => {
      seedPointsLedger(db, 100);

      service.submitRequest(baseRequest);

      const reserved = db
        .prepare(`SELECT COALESCE(SUM(cost_snapshot), 0) as reserved FROM reward_requests WHERE status = 'pending'`)
        .get() as { reserved: number };
      expect(reserved.reserved).toBe(20);
    });

    it('after request, available decreases by cost_snapshot', () => {
      seedPointsLedger(db, 100);

      service.submitRequest(baseRequest);

      const { available } = db
        .prepare(
          `SELECT COALESCE((SELECT SUM(amount) FROM points_ledger), 0)
           - COALESCE((SELECT SUM(cost_snapshot) FROM reward_requests WHERE status = 'pending'), 0)
           AS available`,
        )
        .get() as { available: number };
      expect(available).toBe(80);
    });

    it('multiple pending requests allowed if available points remain sufficient', () => {
      seedPointsLedger(db, 100);

      const first = service.submitRequest(baseRequest);
      const second = service.submitRequest({
        ...baseRequest,
        idempotencyKey: 'key-2',
      });

      expect(first.id).not.toBe(second.id);

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM reward_requests')
        .get() as { count: number };
      expect(rowCount.count).toBe(2);
    });

    it('blocks request when accumulated reservations exhaust available points', () => {
      seedPointsLedger(db, 30);

      service.submitRequest(baseRequest);

      expect(() =>
        service.submitRequest({ ...baseRequest, idempotencyKey: 'key-2' }),
      ).toThrow('insufficient_points');
    });

    it('duplicate idempotency key returns existing request', () => {
      seedPointsLedger(db, 100);

      const first = service.submitRequest(baseRequest);
      const second = service.submitRequest(baseRequest);

      expect(second.id).toBe(first.id);

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM reward_requests')
        .get() as { count: number };
      expect(rowCount.count).toBe(1);
    });

    it('request for archived reward returns ConflictError', () => {
      seedPointsLedger(db, 100);

      expect(() =>
        service.submitRequest({
          ...baseRequest,
          rewardId: 3,
          idempotencyKey: 'archived-key',
        }),
      ).toThrow(ConflictError);
    });

    it('negative available_points blocks new requests', () => {
      expect(() => service.submitRequest(baseRequest)).toThrow('insufficient_points');
    });

    it('creates activity event on submission', () => {
      seedPointsLedger(db, 100);

      service.submitRequest(baseRequest);

      const events = db
        .prepare('SELECT * FROM activity_events WHERE event_type = ?')
        .all('reward_requested') as { summary: string }[];
      expect(events).toHaveLength(1);
      expect(events[0].summary).toContain('Extra Screen Time');
    });

    it('all operations are atomic — rollback on failure leaves no partial state', () => {
      seedPointsLedger(db, 10);

      try {
        service.submitRequest(baseRequest);
      } catch {
        // Expected to fail
      }

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM reward_requests')
        .get() as { count: number };
      expect(rowCount.count).toBe(0);

      const eventCount = db
        .prepare('SELECT COUNT(*) as count FROM activity_events')
        .get() as { count: number };
      expect(eventCount.count).toBe(0);
    });
  });

  describe('cancelRequest', () => {
    it('sets status to canceled and releases reservation', () => {
      seedPointsLedger(db, 100);

      const request = service.submitRequest(baseRequest);
      const canceled = service.cancelRequest(request.id);

      expect(canceled.status).toBe('canceled');

      const reserved = db
        .prepare(`SELECT COALESCE(SUM(cost_snapshot), 0) as reserved FROM reward_requests WHERE status = 'pending'`)
        .get() as { reserved: number };
      expect(reserved.reserved).toBe(0);
    });

    it('canceling already-canceled request returns existing record', () => {
      seedPointsLedger(db, 100);

      const request = service.submitRequest(baseRequest);
      const first = service.cancelRequest(request.id);
      const second = service.cancelRequest(request.id);

      expect(first.id).toBe(second.id);
      expect(second.status).toBe('canceled');
    });

    it('canceling approved request returns ConflictError', () => {
      seedPointsLedger(db, 100);

      const request = service.submitRequest(baseRequest);
      db.prepare('UPDATE reward_requests SET status = ? WHERE id = ?').run('approved', request.id);

      expect(() => service.cancelRequest(request.id)).toThrow(ConflictError);
      expect(() => service.cancelRequest(request.id)).toThrow('cannot_cancel');
    });

    it('canceling nonexistent request throws NotFoundError', () => {
      expect(() => service.cancelRequest(999)).toThrow(NotFoundError);
    });

    it('creates activity event on cancellation', () => {
      seedPointsLedger(db, 100);

      const request = service.submitRequest(baseRequest);
      service.cancelRequest(request.id);

      const events = db
        .prepare('SELECT * FROM activity_events WHERE event_type = ?')
        .all('reward_canceled') as { summary: string }[];
      expect(events).toHaveLength(1);
      expect(events[0].summary).toContain('Extra Screen Time');
    });
  });

  describe('getPendingRewardRequestCount', () => {
    it('returns count of pending reward requests', () => {
      expect(service.getPendingRewardRequestCount()).toBe(0);

      seedPointsLedger(db, 100);
      service.submitRequest(baseRequest);

      expect(service.getPendingRewardRequestCount()).toBe(1);
    });
  });
});
