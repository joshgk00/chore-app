import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createRoutineService, type RoutineService } from '../../src/services/routineService.js';
import { createActivityService, type ActivityService } from '../../src/services/activityService.js';
import { ConflictError, NotFoundError, ValidationError } from '../../src/lib/errors.js';
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

    it('returns existing row when insert hits UNIQUE constraint on idempotency_key', () => {
      const key = 'race-condition-key';

      // Insert a completion row directly via SQL, bypassing the idempotency check
      db.prepare(
        `INSERT INTO routine_completions
           (routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot,
            points_snapshot, requires_approval_snapshot, checklist_snapshot_json,
            randomized_order_json, completion_window_key, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, 'Morning Routine', 'morning', 'once_per_day', 5, 0, '[]', null, null, '2026-03-15', 'approved', key);

      const existing = db.prepare(
        'SELECT id FROM routine_completions WHERE idempotency_key = ?',
      ).get(key) as { id: number };

      // Re-create the service so the idempotency check SELECT runs fresh
      const freshService = createRoutineService(db, activityService);
      const result = freshService.submitCompletion({
        ...baseSubmission,
        idempotencyKey: key,
      });

      expect(result.id).toBe(existing.id);
      expect(result.idempotencyKey).toBe(key);
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

  describe('admin CRUD', () => {
    describe('listRoutinesAdmin', () => {
      it('returns all routines including archived', () => {
        const routines = service.listRoutinesAdmin();

        expect(routines).toHaveLength(5);
        const ids = routines.map((r) => r.id);
        expect(ids).toContain(4);
      });

      it('includes archivedAt field on archived routines', () => {
        const routines = service.listRoutinesAdmin();
        const archived = routines.find((r) => r.id === 4)!;
        expect(archived.archivedAt).toBeDefined();
      });

      it('includes archived checklist items with archivedAt', () => {
        const routines = service.listRoutinesAdmin();
        const routine1 = routines.find((r) => r.id === 1)!;
        expect(routine1.items).toHaveLength(3);
        const archivedItem = routine1.items.find((i) => i.label === 'Old task');
        expect(archivedItem).toBeDefined();
        expect(archivedItem!.archivedAt).toBeDefined();
      });
    });

    describe('getRoutineAdmin', () => {
      it('returns any routine including archived', () => {
        const routine = service.getRoutineAdmin(4);
        expect(routine.id).toBe(4);
        expect(routine.name).toBe('Old Routine');
        expect(routine.archivedAt).toBeDefined();
      });

      it('includes all checklist items including archived', () => {
        const routine = service.getRoutineAdmin(1);
        expect(routine.items).toHaveLength(3);
        const archivedItem = routine.items.find((i) => i.label === 'Old task');
        expect(archivedItem).toBeDefined();
        expect(archivedItem!.archivedAt).toBeDefined();
      });

      it('throws NotFoundError for nonexistent routine', () => {
        expect(() => service.getRoutineAdmin(999)).toThrow(NotFoundError);
      });
    });

    describe('createRoutine', () => {
      it('creates routine with items', () => {
        const routine = service.createRoutine({
          name: 'Test Routine',
          timeSlot: 'morning',
          completionRule: 'once_per_day',
          points: 10,
          requiresApproval: false,
          randomizeItems: true,
          sortOrder: 10,
          items: [
            { label: 'Item A', sortOrder: 1 },
            { label: 'Item B', sortOrder: 2 },
          ],
        });

        expect(routine.name).toBe('Test Routine');
        expect(routine.points).toBe(10);
        expect(routine.randomizeItems).toBe(true);
        expect(routine.items).toHaveLength(2);
        expect(routine.items[0].label).toBe('Item A');
        expect(routine.items[1].label).toBe('Item B');
      });

      it('throws ValidationError for empty name', () => {
        expect(() =>
          service.createRoutine({
            name: '',
            timeSlot: 'morning',
            completionRule: 'once_per_day',
            points: 5,
            requiresApproval: false,
            randomizeItems: false,
            sortOrder: 1,
            items: [{ label: 'A', sortOrder: 1 }],
          }),
        ).toThrow(ValidationError);
      });

      it('throws ValidationError for negative points', () => {
        expect(() =>
          service.createRoutine({
            name: 'Bad Points',
            timeSlot: 'morning',
            completionRule: 'once_per_day',
            points: -1,
            requiresApproval: false,
            randomizeItems: false,
            sortOrder: 1,
            items: [{ label: 'A', sortOrder: 1 }],
          }),
        ).toThrow(ValidationError);
      });

      it('throws ValidationError for once_per_slot with anytime', () => {
        expect(() =>
          service.createRoutine({
            name: 'Bad Combo',
            timeSlot: 'anytime',
            completionRule: 'once_per_slot',
            points: 5,
            requiresApproval: false,
            randomizeItems: false,
            sortOrder: 1,
            items: [{ label: 'A', sortOrder: 1 }],
          }),
        ).toThrow(ValidationError);
      });

      it('throws ValidationError for no items', () => {
        expect(() =>
          service.createRoutine({
            name: 'No Items',
            timeSlot: 'morning',
            completionRule: 'once_per_day',
            points: 5,
            requiresApproval: false,
            randomizeItems: false,
            sortOrder: 1,
            items: [],
          }),
        ).toThrow(ValidationError);
      });
    });

    describe('updateRoutine', () => {
      it('updates routine fields', () => {
        const routine = service.updateRoutine(1, { name: 'Updated', points: 20 });
        expect(routine.name).toBe('Updated');
        expect(routine.points).toBe(20);
      });

      it('adds new checklist items', () => {
        const routine = service.updateRoutine(1, {
          items: [{ label: 'New item', sortOrder: 10 }],
        });
        const labels = routine.items.map((i) => i.label);
        expect(labels).toContain('New item');
      });

      it('updates existing checklist items', () => {
        const routine = service.updateRoutine(1, {
          items: [{ id: 1, label: 'Updated label', sortOrder: 1 }],
        });
        const item = routine.items.find((i) => i.id === 1)!;
        expect(item.label).toBe('Updated label');
      });

      it('archives checklist items', () => {
        const routine = service.updateRoutine(1, {
          items: [{ id: 1, label: 'Brush teeth', sortOrder: 1, shouldArchive: true }],
        });
        const item = routine.items.find((i) => i.id === 1)!;
        expect(item.archivedAt).toBeDefined();
      });

      it('throws NotFoundError for nonexistent routine', () => {
        expect(() => service.updateRoutine(999, { name: 'Ghost' })).toThrow(NotFoundError);
      });

      it('throws ConflictError for archived routine', () => {
        expect(() => service.updateRoutine(4, { name: 'Updated' })).toThrow(ConflictError);
      });

      it('validates combined fields after merge', () => {
        expect(() =>
          service.updateRoutine(2, { timeSlot: 'anytime' }),
        ).toThrow(ValidationError);
      });
    });

    describe('archiveRoutine', () => {
      it('sets archived_at on active routine', () => {
        service.archiveRoutine(1);
        const routine = service.getRoutineAdmin(1);
        expect(routine.archivedAt).toBeDefined();
      });

      it('throws NotFoundError for already archived routine', () => {
        expect(() => service.archiveRoutine(4)).toThrow(NotFoundError);
      });

      it('throws NotFoundError for nonexistent routine', () => {
        expect(() => service.archiveRoutine(999)).toThrow(NotFoundError);
      });
    });

    describe('unarchiveRoutine', () => {
      it('clears archived_at on archived routine', () => {
        service.unarchiveRoutine(4);
        const routine = service.getRoutineAdmin(4);
        expect(routine.archivedAt).toBeUndefined();
      });

      it('throws NotFoundError for non-archived routine', () => {
        expect(() => service.unarchiveRoutine(1)).toThrow(NotFoundError);
      });

      it('throws NotFoundError for nonexistent routine', () => {
        expect(() => service.unarchiveRoutine(999)).toThrow(NotFoundError);
      });
    });
  });
});
