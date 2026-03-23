import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createRoutineService, type RoutineService } from '../../src/services/routineService.js';
import { createActivityService, type ActivityService } from '../../src/services/activityService.js';
import { ConflictError, NotFoundError } from '../../src/lib/errors.js';
import type { TimeSlot } from '@chore-app/shared';
import { seedRoutineData } from '../helpers/seed-routines.js';

const baseSubmission = {
  routineId: 1,
  checklistSnapshot: JSON.stringify([
    { itemId: 1, isChecked: true },
    { itemId: 2, isChecked: true },
  ]),
  randomizedOrder: null,
  idempotencyKey: 'test-key-1',
  localDate: '2026-03-15',
  timeSlot: 'morning' as const,
};

let db: Database.Database;
let activityService: ActivityService;
let service: RoutineService;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  activityService = createActivityService(db);
  service = createRoutineService(db, activityService);
});

afterEach(() => {
  db.close();
});

describe('routineService', () => {
  describe('getActiveRoutines', () => {
    it('returns only active routines with active checklist items', () => {
      const routines = service.getActiveRoutines();

      expect(routines).toHaveLength(4);
      expect(routines.map((r) => r.id)).toEqual([1, 2, 3, 5]);

      const routine1 = routines.find((r) => r.id === 1)!;
      expect(routine1.items).toHaveLength(2);
      expect(routine1.items.map((i) => i.label)).toEqual(['Brush teeth', 'Make bed']);
    });

    it('excludes archived routines', () => {
      const routines = service.getActiveRoutines();
      const ids = routines.map((r) => r.id);

      expect(ids).not.toContain(4);
    });
  });

  describe('getRoutineById', () => {
    it('returns correct routine with items', () => {
      const routine = service.getRoutineById(1);

      expect(routine.id).toBe(1);
      expect(routine.name).toBe('Morning Routine');
      expect(routine.timeSlot).toBe('morning');
      expect(routine.completionRule).toBe('once_per_day');
      expect(routine.points).toBe(5);
      expect(routine.requiresApproval).toBe(false);
      expect(routine.randomizeItems).toBe(true);
      expect(routine.items).toHaveLength(2);
      expect(routine.items[0].label).toBe('Brush teeth');
      expect(routine.items[1].label).toBe('Make bed');
    });

    it('throws NotFoundError for archived routine', () => {
      expect(() => service.getRoutineById(4)).toThrow(NotFoundError);
    });

    it('throws NotFoundError for nonexistent routine', () => {
      expect(() => service.getRoutineById(999)).toThrow(NotFoundError);
    });
  });

  describe('submitCompletion', () => {
    it('creates completion with correct snapshot fields', () => {
      const completion = service.submitCompletion(baseSubmission);

      expect(completion.routineId).toBe(1);
      expect(completion.routineNameSnapshot).toBe('Morning Routine');
      expect(completion.timeSlotSnapshot).toBe('morning');
      expect(completion.completionRuleSnapshot).toBe('once_per_day');
      expect(completion.pointsSnapshot).toBe(5);
      expect(completion.requiresApprovalSnapshot).toBe(false);
      expect(completion.checklistSnapshotJson).toBe(baseSubmission.checklistSnapshot);
      expect(completion.randomizedOrderJson).toBeNull();
      expect(completion.localDate).toBe('2026-03-15');
      expect(completion.idempotencyKey).toBe('test-key-1');
    });

    it('with requires_approval=false creates ledger entry immediately', () => {
      const completion = service.submitCompletion(baseSubmission);

      expect(completion.status).toBe('approved');

      const ledger = db
        .prepare('SELECT * FROM points_ledger WHERE reference_table = ? AND reference_id = ?')
        .get('routine_completions', completion.id) as {
        entry_type: string;
        amount: number;
        note: string;
      };
      expect(ledger.entry_type).toBe('routine');
      expect(ledger.amount).toBe(5);
      expect(ledger.note).toBe('Completed: Morning Routine');
    });

    it('with requires_approval=true does NOT create ledger entry', () => {
      const completion = service.submitCompletion({
        ...baseSubmission,
        routineId: 2,
        idempotencyKey: 'approval-key',
        timeSlot: 'afternoon',
      });

      expect(completion.status).toBe('pending');

      const ledgerCount = db
        .prepare('SELECT COUNT(*) as count FROM points_ledger')
        .get() as { count: number };
      expect(ledgerCount.count).toBe(0);
    });

    it('duplicate idempotency key returns existing completion', () => {
      const first = service.submitCompletion(baseSubmission);
      const second = service.submitCompletion(baseSubmission);

      expect(second.id).toBe(first.id);

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM routine_completions')
        .get() as { count: number };
      expect(rowCount.count).toBe(1);
    });

    it('once_per_day blocks second completion on same local_date', () => {
      service.submitCompletion(baseSubmission);

      expect(() =>
        service.submitCompletion({
          ...baseSubmission,
          idempotencyKey: 'test-key-2',
        }),
      ).toThrow(ConflictError);

      expect(() =>
        service.submitCompletion({
          ...baseSubmission,
          idempotencyKey: 'test-key-3',
        }),
      ).toThrow('already_completed');
    });

    it('once_per_day allows completion on a different local_date', () => {
      const first = service.submitCompletion(baseSubmission);

      const second = service.submitCompletion({
        ...baseSubmission,
        localDate: '2026-03-16',
        idempotencyKey: 'test-key-2',
      });

      expect(first.id).not.toBe(second.id);
    });

    it('once_per_slot blocks second completion in same slot+date', () => {
      service.submitCompletion({
        ...baseSubmission,
        routineId: 2,
        idempotencyKey: 'slot-key-1',
        timeSlot: 'afternoon',
      });

      expect(() =>
        service.submitCompletion({
          ...baseSubmission,
          routineId: 2,
          idempotencyKey: 'slot-key-2',
          timeSlot: 'afternoon',
        }),
      ).toThrow(ConflictError);
    });

    it('once_per_slot allows completion in different slot same day', () => {
      const first = service.submitCompletion({
        ...baseSubmission,
        routineId: 2,
        idempotencyKey: 'slot-key-1',
        timeSlot: 'afternoon',
      });

      const second = service.submitCompletion({
        ...baseSubmission,
        routineId: 2,
        idempotencyKey: 'slot-key-2',
        timeSlot: 'morning' as TimeSlot,
      });

      expect(first.id).not.toBe(second.id);
    });

    it('unlimited allows multiple completions same day', () => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(
          service.submitCompletion({
            ...baseSubmission,
            routineId: 3,
            idempotencyKey: `unlimited-key-${i}`,
            timeSlot: 'anytime',
          }),
        );
      }

      expect(results[0].id).not.toBe(results[1].id);
      expect(results[1].id).not.toBe(results[2].id);

      const rowCount = db
        .prepare('SELECT COUNT(*) as count FROM routine_completions')
        .get() as { count: number };
      expect(rowCount.count).toBe(3);
    });

    it('completion for archived routine returns ConflictError', () => {
      expect(() =>
        service.submitCompletion({
          ...baseSubmission,
          routineId: 4,
          idempotencyKey: 'archived-key',
        }),
      ).toThrow(ConflictError);

      expect(() =>
        service.submitCompletion({
          ...baseSubmission,
          routineId: 4,
          idempotencyKey: 'archived-key-2',
        }),
      ).toThrow('archived');
    });

    it('snapshot fields match routine state at submission time, not after subsequent edit', () => {
      const completion = service.submitCompletion(baseSubmission);

      db.prepare('UPDATE routines SET name = ? WHERE id = ?').run('Changed Name', 1);

      expect(completion.routineNameSnapshot).toBe('Morning Routine');
    });

    it('rejected completion frees the window key for re-submission', () => {
      const first = service.submitCompletion(baseSubmission);

      db.prepare('UPDATE routine_completions SET status = ? WHERE id = ?').run(
        'rejected',
        first.id,
      );

      const second = service.submitCompletion({
        ...baseSubmission,
        idempotencyKey: 'test-key-2',
      });

      expect(second.id).not.toBe(first.id);
      expect(second.status).toBe('approved');
    });
  });

  describe('getPendingCompletionCount', () => {
    it('returns count of pending completions', () => {
      expect(service.getPendingCompletionCount()).toBe(0);

      service.submitCompletion({
        ...baseSubmission,
        routineId: 2,
        idempotencyKey: 'pending-key',
        timeSlot: 'afternoon',
      });

      expect(service.getPendingCompletionCount()).toBe(1);
    });
  });
});
