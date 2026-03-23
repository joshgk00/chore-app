import type Database from "better-sqlite3";
import type {
  Routine,
  ChecklistItem,
  RoutineCompletion,
  TimeSlot,
  CompletionRule,
  Status,
} from "@chore-app/shared";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import { getCompletionWindowKey } from "../lib/timeSlots.js";
import type { ActivityService } from "./activityService.js";
import type { BadgeService } from "./badgeService.js";

export interface SubmitCompletionData {
  routineId: number;
  checklistSnapshot: string;
  randomizedOrder: string | null;
  idempotencyKey: string;
  localDate: string;
  timeSlot: TimeSlot;
}

export interface RoutineService {
  getActiveRoutines(): Routine[];
  getRoutineById(id: number): Routine;
  submitCompletion(data: SubmitCompletionData): RoutineCompletion;
  getPendingCompletionCount(): number;
}

interface RoutineRow {
  id: number;
  name: string;
  time_slot: string;
  completion_rule: string;
  points: number;
  requires_approval: number;
  image_asset_id: number | null;
  randomize_items: number;
  active: number;
  sort_order: number;
  archived_at: string | null;
}

interface ChecklistItemRow {
  id: number;
  routine_id: number;
  label: string;
  image_asset_id: number | null;
  sort_order: number;
}

interface CompletionRow {
  id: number;
  routine_id: number;
  routine_name_snapshot: string;
  time_slot_snapshot: string;
  completion_rule_snapshot: string;
  points_snapshot: number;
  requires_approval_snapshot: number;
  checklist_snapshot_json: string | null;
  randomized_order_json: string | null;
  completion_window_key: string | null;
  completed_at: string;
  local_date: string;
  status: string;
  idempotency_key: string;
}

function mapRoutineRow(row: RoutineRow): Routine {
  return {
    id: row.id,
    name: row.name,
    timeSlot: row.time_slot as TimeSlot,
    completionRule: row.completion_rule as CompletionRule,
    points: row.points,
    requiresApproval: row.requires_approval === 1,
    imageAssetId: row.image_asset_id ?? undefined,
    randomizeItems: row.randomize_items === 1,
    sortOrder: row.sort_order,
    items: [],
  };
}

function mapChecklistItemRow(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    routineId: row.routine_id,
    label: row.label,
    imageAssetId: row.image_asset_id ?? undefined,
    sortOrder: row.sort_order,
  };
}

function mapCompletionRow(row: CompletionRow): RoutineCompletion {
  return {
    id: row.id,
    routineId: row.routine_id,
    routineNameSnapshot: row.routine_name_snapshot,
    timeSlotSnapshot: row.time_slot_snapshot,
    completionRuleSnapshot: row.completion_rule_snapshot,
    pointsSnapshot: row.points_snapshot,
    requiresApprovalSnapshot: row.requires_approval_snapshot === 1,
    checklistSnapshotJson: row.checklist_snapshot_json,
    randomizedOrderJson: row.randomized_order_json,
    completionWindowKey: row.completion_window_key,
    completedAt: row.completed_at,
    localDate: row.local_date,
    status: row.status as Status,
    idempotencyKey: row.idempotency_key,
  };
}

export function createRoutineService(
  db: Database.Database,
  activityService: ActivityService,
  badgeService?: BadgeService,
): RoutineService {
  const selectActiveRoutinesStmt = db.prepare(
    `SELECT id, name, time_slot, completion_rule, points, requires_approval,
            image_asset_id, randomize_items, active, sort_order, archived_at
     FROM routines
     WHERE active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectActiveItemsStmt = db.prepare(
    `SELECT id, routine_id, label, image_asset_id, sort_order
     FROM checklist_items
     WHERE routine_id = ? AND active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectAllActiveItemsStmt = db.prepare(
    `SELECT ci.id, ci.routine_id, ci.label, ci.image_asset_id, ci.sort_order
     FROM checklist_items ci
     INNER JOIN routines r ON ci.routine_id = r.id
     WHERE ci.active = 1 AND ci.archived_at IS NULL
       AND r.active = 1 AND r.archived_at IS NULL
     ORDER BY ci.routine_id, ci.sort_order ASC`,
  );

  const selectRoutineByIdStmt = db.prepare(
    `SELECT id, name, time_slot, completion_rule, points, requires_approval,
            image_asset_id, randomize_items, active, sort_order, archived_at
     FROM routines
     WHERE id = ?`,
  );

  const selectCompletionByKeyStmt = db.prepare(
    `SELECT id, routine_id, routine_name_snapshot, time_slot_snapshot,
            completion_rule_snapshot, points_snapshot, requires_approval_snapshot,
            checklist_snapshot_json, randomized_order_json, completion_window_key,
            completed_at, local_date, status, idempotency_key
     FROM routine_completions
     WHERE idempotency_key = ?`,
  );

  const selectCompletionByWindowStmt = db.prepare(
    `SELECT id FROM routine_completions
     WHERE completion_window_key = ? AND status IN ('pending', 'approved')`,
  );

  const insertCompletionStmt = db.prepare(
    `INSERT INTO routine_completions
       (routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot,
        points_snapshot, requires_approval_snapshot, checklist_snapshot_json,
        randomized_order_json, completion_window_key, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const selectCompletionByIdStmt = db.prepare(
    `SELECT id, routine_id, routine_name_snapshot, time_slot_snapshot,
            completion_rule_snapshot, points_snapshot, requires_approval_snapshot,
            checklist_snapshot_json, randomized_order_json, completion_window_key,
            completed_at, local_date, status, idempotency_key
     FROM routine_completions
     WHERE id = ?`,
  );

  const insertLedgerStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('routine', 'routine_completions', ?, ?, ?)`,
  );

  const countPendingStmt = db.prepare(
    `SELECT COUNT(*) as count FROM routine_completions WHERE status = 'pending'`,
  );

  function getActiveRoutines(): Routine[] {
    const rows = selectActiveRoutinesStmt.all() as RoutineRow[];
    const allItemRows = selectAllActiveItemsStmt.all() as ChecklistItemRow[];

    const itemsByRoutineId = new Map<number, ChecklistItem[]>();
    for (const itemRow of allItemRows) {
      let items = itemsByRoutineId.get(itemRow.routine_id);
      if (!items) {
        items = [];
        itemsByRoutineId.set(itemRow.routine_id, items);
      }
      items.push(mapChecklistItemRow(itemRow));
    }

    return rows.map((row) => {
      const routine = mapRoutineRow(row);
      routine.items = itemsByRoutineId.get(row.id) ?? [];
      return routine;
    });
  }

  function getRoutineById(id: number): Routine {
    const row = selectRoutineByIdStmt.get(id) as RoutineRow | undefined;
    if (!row || row.active !== 1 || row.archived_at !== null) {
      throw new NotFoundError("Routine not found");
    }
    const routine = mapRoutineRow(row);
    const itemRows = selectActiveItemsStmt.all(id) as ChecklistItemRow[];
    routine.items = itemRows.map(mapChecklistItemRow);
    return routine;
  }

  const submitCompletionTx = db.transaction((data: SubmitCompletionData): RoutineCompletion => {
    const existingCompletion = selectCompletionByKeyStmt.get(
      data.idempotencyKey,
    ) as CompletionRow | undefined;
    if (existingCompletion) {
      return mapCompletionRow(existingCompletion);
    }

    const routine = selectRoutineByIdStmt.get(data.routineId) as RoutineRow | undefined;
    if (!routine || routine.active === 0 || routine.archived_at !== null) {
      throw new ConflictError("archived");
    }

    const windowKey = getCompletionWindowKey(
      data.routineId,
      routine.completion_rule as CompletionRule,
      data.localDate,
      data.timeSlot,
    );

    if (windowKey !== null) {
      const existingWindow = selectCompletionByWindowStmt.get(windowKey) as
        | { id: number }
        | undefined;
      if (existingWindow) {
        throw new ConflictError("already_completed");
      }
    }

    const status = routine.requires_approval === 1 ? "pending" : "approved";

    let completionId: number;
    try {
      const result = insertCompletionStmt.run(
        data.routineId,
        routine.name,
        routine.time_slot,
        routine.completion_rule,
        routine.points,
        routine.requires_approval,
        data.checklistSnapshot,
        data.randomizedOrder,
        windowKey,
        data.localDate,
        status,
        data.idempotencyKey,
      );
      completionId = Number(result.lastInsertRowid);
    } catch (err: unknown) {
      const sqliteErr = err as { code?: string; message?: string };
      if (
        (sqliteErr.code === "SQLITE_CONSTRAINT_UNIQUE" ||
          sqliteErr.code === "SQLITE_CONSTRAINT") &&
        sqliteErr.message?.includes("idempotency_key")
      ) {
        const existing = selectCompletionByKeyStmt.get(
          data.idempotencyKey,
        ) as CompletionRow;
        return mapCompletionRow(existing);
      }
      throw err;
    }

    if (status === "approved") {
      insertLedgerStmt.run(
        completionId,
        routine.points,
        "Completed: " + routine.name,
      );
      badgeService?.evaluateBadges({ type: "routine_completion" });
    }

    activityService.recordActivityOrThrow({
      eventType: "routine_submitted",
      entityType: "routine_completion",
      entityId: completionId,
      summary: `Completed ${routine.name} for ${routine.points} points`,
    });

    const inserted = selectCompletionByIdStmt.get(completionId) as CompletionRow;
    return mapCompletionRow(inserted);
  });

  function submitCompletion(data: SubmitCompletionData): RoutineCompletion {
    return submitCompletionTx(data);
  }

  function getPendingCompletionCount(): number {
    const row = countPendingStmt.get() as { count: number };
    return row.count;
  }

  return { getActiveRoutines, getRoutineById, submitCompletion, getPendingCompletionCount };
}
