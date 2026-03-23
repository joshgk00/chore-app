import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createChoreService, type ChoreService } from '../../src/services/choreService.js';
import { createActivityService, type ActivityService } from '../../src/services/activityService.js';
import { ConflictError, NotFoundError } from '../../src/lib/errors.js';
import { seedChoreData } from '../helpers/seed-chores.js';

const baseSubmission = {
  choreId: 1,
  tierId: 1,
  idempotencyKey: 'test-key-1',
  localDate: '2026-03-15',
};

let db: Database.Database;
let activityService: ActivityService;
let service: ChoreService;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedChoreData(db);
  activityService = createActivityService(db);
  service = createChoreService(db, activityService);
});

afterEach(() => {
  db.close();
});

describe('choreService', () => {
  describe('getActiveChores', () => {
    it('returns chores with active tiers only', () => {
      const chores = service.getActiveChores();

      // chores 1, 2, 4 are active (3 is archived)
      expect(chores).toHaveLength(3);
      expect(chores.map((c) => c.id)).toEqual([1, 2, 4]);

      const kitchen = chores.find((c) => c.id === 1)!;
      expect(kitchen.tiers).toHaveLength(2);
      expect(kitchen.tiers.map((t) => t.name)).toEqual(['Quick Clean', 'Deep Clean']);
    });

    it('excludes archived chores', () => {
      const chores = service.getActiveChores();
      const ids = chores.map((c) => c.id);

      expect(ids).not.toContain(3);
    });

    it('excludes archived tiers from active chores', () => {
      const chores = service.getActiveChores();
      const laundry = chores.find((c) => c.id === 4)!;

      expect(laundry.tiers).toHaveLength(1);
      expect(laundry.tiers[0].name).toBe('Wash & Fold');
    });
  });

  describe('submitChoreLog', () => {
    it('creates log with correct snapshot fields', () => {
      const log = service.submitChoreLog(baseSubmission);

      expect(log.choreId).toBe(1);
      expect(log.choreNameSnapshot).toBe('Clean Kitchen');
      expect(log.tierId).toBe(1);
      expect(log.tierNameSnapshot).toBe('Quick Clean');
      expect(log.pointsSnapshot).toBe(3);
      expect(log.requiresApprovalSnapshot).toBe(false);
      expect(log.localDate).toBe('2026-03-15');
      expect(log.idempotencyKey).toBe('test-key-1');
    });

    it('with requires_approval=false creates immediate ledger entry', () => {
      const log = service.submitChoreLog(baseSubmission);

      expect(log.status).toBe('approved');

      const ledger = db
        .prepare('SELECT * FROM points_ledger WHERE reference_table = ? AND reference_id = ?')
        .get('chore_logs', log.id) as {
        entry_type: string;
        amount: number;
        note: string;
      };
      expect(ledger.entry_type).toBe('chore');
      expect(ledger.amount).toBe(3);
      expect(ledger.note).toBe('Chore: Clean Kitchen (Quick Clean)');
    });

    it('with requires_approval=true sets status to pending', () => {
      const log = service.submitChoreLog({
        ...baseSubmission,
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'approval-key',
      });

      expect(log.status).toBe('pending');

      const ledgerCount = db
        .prepare('SELECT COUNT(*) as count FROM points_ledger')
        .get() as { count: number };
      expect(ledgerCount.count).toBe(0);
    });

    it('duplicate idempotency key returns existing log', () => {
      const first = service.submitChoreLog(baseSubmission);
      const second = service.submitChoreLog(baseSubmission);

      expect(second.id).toBe(first.id);

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM chore_logs')
        .get() as { count: number };
      expect(rowCount.count).toBe(1);
    });

    it('log for archived chore returns ConflictError', () => {
      expect(() =>
        service.submitChoreLog({
          ...baseSubmission,
          choreId: 3,
          tierId: 4,
          idempotencyKey: 'archived-key',
        }),
      ).toThrow(ConflictError);

      expect(() =>
        service.submitChoreLog({
          ...baseSubmission,
          choreId: 3,
          tierId: 4,
          idempotencyKey: 'archived-key-2',
        }),
      ).toThrow('archived');
    });

    it('log for archived tier returns ConflictError', () => {
      expect(() =>
        service.submitChoreLog({
          ...baseSubmission,
          choreId: 4,
          tierId: 6,
          idempotencyKey: 'archived-tier-key',
        }),
      ).toThrow(ConflictError);
    });

    it('log for tier belonging to different chore returns ConflictError', () => {
      expect(() =>
        service.submitChoreLog({
          ...baseSubmission,
          choreId: 1,
          tierId: 3,
          idempotencyKey: 'mismatch-key',
        }),
      ).toThrow(ConflictError);

      expect(() =>
        service.submitChoreLog({
          ...baseSubmission,
          choreId: 1,
          tierId: 3,
          idempotencyKey: 'mismatch-key-2',
        }),
      ).toThrow('tier_chore_mismatch');
    });

    it('multiple chore logs for same chore are allowed', () => {
      const first = service.submitChoreLog(baseSubmission);
      const second = service.submitChoreLog({
        ...baseSubmission,
        idempotencyKey: 'test-key-2',
      });
      const third = service.submitChoreLog({
        ...baseSubmission,
        idempotencyKey: 'test-key-3',
      });

      expect(first.id).not.toBe(second.id);
      expect(second.id).not.toBe(third.id);

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM chore_logs')
        .get() as { count: number };
      expect(rowCount.count).toBe(3);
    });

    it('creates activity event on submission', () => {
      service.submitChoreLog(baseSubmission);

      const events = db
        .prepare('SELECT * FROM activity_events WHERE event_type = ?')
        .all('chore_submitted') as { summary: string }[];
      expect(events).toHaveLength(1);
      expect(events[0].summary).toContain('Clean Kitchen');
    });

    it('returns existing row when insert hits UNIQUE constraint on idempotency_key', () => {
      const key = 'race-condition-key';

      db.prepare(
        `INSERT INTO chore_logs
           (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot, points_snapshot,
            requires_approval_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'Clean Kitchen', 1, 'Quick Clean', 3, 0, '2026-03-15', 'approved', key);

      const existing = db.prepare(
        'SELECT id FROM chore_logs WHERE idempotency_key = ?',
      ).get(key) as { id: number };

      const freshService = createChoreService(db, activityService);
      const result = freshService.submitChoreLog({
        ...baseSubmission,
        idempotencyKey: key,
      });

      expect(result.id).toBe(existing.id);
      expect(result.idempotencyKey).toBe(key);
    });

    it('snapshot fields match chore state at submission time, not after edit', () => {
      const log = service.submitChoreLog(baseSubmission);

      db.prepare('UPDATE chores SET name = ? WHERE id = ?').run('Changed Name', 1);

      expect(log.choreNameSnapshot).toBe('Clean Kitchen');
    });
  });

  describe('cancelChoreLog', () => {
    it('changes status to canceled', () => {
      const log = service.submitChoreLog({
        ...baseSubmission,
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'cancel-key',
      });

      const canceled = service.cancelChoreLog(log.id);

      expect(canceled.status).toBe('canceled');
    });

    it('canceling already-canceled log returns existing record', () => {
      const log = service.submitChoreLog({
        ...baseSubmission,
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'cancel-idem-key',
      });

      const first = service.cancelChoreLog(log.id);
      const second = service.cancelChoreLog(log.id);

      expect(first.id).toBe(second.id);
      expect(second.status).toBe('canceled');
    });

    it('canceling approved log returns ConflictError', () => {
      const log = service.submitChoreLog(baseSubmission);
      expect(log.status).toBe('approved');

      expect(() => service.cancelChoreLog(log.id)).toThrow(ConflictError);
      expect(() => service.cancelChoreLog(log.id)).toThrow('cannot_cancel');
    });

    it('canceling rejected log returns ConflictError', () => {
      const log = service.submitChoreLog({
        ...baseSubmission,
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'reject-key',
      });

      db.prepare('UPDATE chore_logs SET status = ? WHERE id = ?').run('rejected', log.id);

      expect(() => service.cancelChoreLog(log.id)).toThrow(ConflictError);
    });

    it('canceling nonexistent log throws NotFoundError', () => {
      expect(() => service.cancelChoreLog(999)).toThrow(NotFoundError);
    });

    it('creates activity event on cancellation', () => {
      const log = service.submitChoreLog({
        ...baseSubmission,
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'cancel-event-key',
      });

      service.cancelChoreLog(log.id);

      const events = db
        .prepare('SELECT * FROM activity_events WHERE event_type = ?')
        .all('chore_canceled') as { summary: string }[];
      expect(events).toHaveLength(1);
      expect(events[0].summary).toContain('Yard Work');
    });
  });

  describe('getPendingChoreLogCount', () => {
    it('returns count of pending chore logs', () => {
      expect(service.getPendingChoreLogCount()).toBe(0);

      service.submitChoreLog({
        ...baseSubmission,
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'pending-key',
      });

      expect(service.getPendingChoreLogCount()).toBe(1);
    });
  });
});
