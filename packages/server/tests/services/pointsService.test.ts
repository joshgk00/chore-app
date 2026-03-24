import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createPointsService, type PointsService } from '../../src/services/pointsService.js';
import { createActivityService, type ActivityService } from '../../src/services/activityService.js';
import { seedRewardData, seedPointsLedger } from '../helpers/seed-rewards.js';

let db: Database.Database;
let service: PointsService;
let activityService: ActivityService;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRewardData(db);
  activityService = createActivityService(db);
  service = createPointsService(db, activityService);
});

afterEach(() => {
  db.close();
});

describe('pointsService', () => {
  describe('getBalance', () => {
    it('returns zeros with empty ledger', () => {
      const balance = service.getBalance();

      expect(balance).toEqual({ total: 0, reserved: 0, available: 0 });
    });

    it('after positive ledger entry shows correct total', () => {
      seedPointsLedger(db, 50);

      const balance = service.getBalance();

      expect(balance.total).toBe(50);
      expect(balance.available).toBe(50);
      expect(balance.reserved).toBe(0);
    });

    it('with pending reward request shows correct reserved and available', () => {
      seedPointsLedger(db, 100);

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).run(1, 'Extra Screen Time', 20, '2026-03-15', 'points-test-key');

      const balance = service.getBalance();

      expect(balance.total).toBe(100);
      expect(balance.reserved).toBe(20);
      expect(balance.available).toBe(80);
    });

    it('available = total - reserved with mixed ledger entries', () => {
      seedPointsLedger(db, 75);
      seedPointsLedger(db, 25);

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).run(1, 'Extra Screen Time', 20, '2026-03-15', 'key-1');

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).run(2, 'Movie Night Pick', 50, '2026-03-15', 'key-2');

      const balance = service.getBalance();

      expect(balance.total).toBe(100);
      expect(balance.reserved).toBe(70);
      expect(balance.available).toBe(30);
    });

    it('canceled requests are not counted as reserved', () => {
      seedPointsLedger(db, 100);

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'canceled', ?)`,
      ).run(1, 'Extra Screen Time', 20, '2026-03-15', 'canceled-key');

      const balance = service.getBalance();

      expect(balance.reserved).toBe(0);
      expect(balance.available).toBe(100);
    });
  });

  describe('getLedger', () => {
    it('returns entries in descending date order', () => {
      seedPointsLedger(db, 10);
      seedPointsLedger(db, 20);
      seedPointsLedger(db, 30);

      const entries = service.getLedger({ limit: 10, offset: 0 });

      expect(entries).toHaveLength(3);
      expect(entries[0].amount).toBe(30);
      expect(entries[2].amount).toBe(10);
    });

    it('pagination with limit/offset works', () => {
      for (let i = 1; i <= 5; i++) {
        seedPointsLedger(db, i * 10);
      }

      const page1 = service.getLedger({ limit: 2, offset: 0 });
      const page2 = service.getLedger({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].amount).toBe(50);
      expect(page2[0].amount).toBe(30);
    });

    it('returns correct fields', () => {
      seedPointsLedger(db, 42);

      const entries = service.getLedger({ limit: 10, offset: 0 });

      expect(entries).toHaveLength(1);
      expect(entries[0].entryType).toBe('manual');
      expect(entries[0].amount).toBe(42);
      expect(entries[0].note).toBe('Test points');
      expect(entries[0]).toHaveProperty('createdAt');
    });

    it('caps limit at 100', () => {
      for (let i = 0; i < 5; i++) {
        seedPointsLedger(db, i);
      }

      const entries = service.getLedger({ limit: 200, offset: 0 });

      expect(entries).toHaveLength(5);
    });
  });

  describe('createAdjustment', () => {
    it('positive adjustment increases total', () => {
      seedPointsLedger(db, 50);

      service.createAdjustment(25, 'Bonus points');

      const balance = service.getBalance();
      expect(balance.total).toBe(75);
    });

    it('negative adjustment decreases total', () => {
      seedPointsLedger(db, 100);

      service.createAdjustment(-30, 'Point correction');

      const balance = service.getBalance();
      expect(balance.total).toBe(70);
    });

    it('returns created LedgerEntry with entry_type manual', () => {
      const entry = service.createAdjustment(10, 'Test adjustment');

      expect(entry.entryType).toBe('manual');
      expect(entry.amount).toBe(10);
      expect(entry.note).toBe('Test adjustment');
      expect(entry.referenceTable).toBeNull();
      expect(entry.referenceId).toBeNull();
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('createdAt');
    });

    it('throws ValidationError when note is empty', () => {
      expect(() => service.createAdjustment(10, '')).toThrow('note is required');
    });

    it('throws ValidationError when note is only whitespace', () => {
      expect(() => service.createAdjustment(10, '   ')).toThrow('note is required');
    });

    it('throws ValidationError when note exceeds 500 chars', () => {
      expect(() => service.createAdjustment(10, 'a'.repeat(501))).toThrow(
        'note must be 500 characters or fewer',
      );
    });

    it('throws ValidationError when amount is 0', () => {
      expect(() => service.createAdjustment(0, 'Zero adjustment')).toThrow(
        'amount must be a non-zero integer',
      );
    });

    it('throws ValidationError when amount is not integer', () => {
      expect(() => service.createAdjustment(1.5, 'Fractional amount')).toThrow(
        'amount must be a non-zero integer',
      );
    });

    it('negative adjustment can make available_points negative', () => {
      service.createAdjustment(-50, 'Overdraft correction');

      const balance = service.getBalance();
      expect(balance.total).toBe(-50);
      expect(balance.available).toBe(-50);
    });

    it('records activity event', () => {
      service.createAdjustment(15, 'Reward bonus');

      const events = activityService.getRecentActivity(1);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('manual_adjustment');
      expect(events[0].entityType).toBe('points_ledger');
      expect(events[0].summary).toContain('+15');
      expect(events[0].summary).toContain('Reward bonus');
    });
  });
});
