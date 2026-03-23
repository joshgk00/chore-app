import type Database from "better-sqlite3";
import type {
  Routine,
  ChecklistItem,
  RoutineCompletion,
  TimeSlot,
  CompletionRule,
  Status,
} from "@chore-app/shared";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
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

export interface CreateRoutineData {
  name: string;
  timeSlot: TimeSlot;
  completionRule: CompletionRule;
  points: number;
  requiresApproval: boolean;
  randomizeItems: boolean;
  sortOrder: number;
  items: { label: string; sortOrder: number }[];
}

export interface UpdateRoutineData {
  name?: string;
  timeSlot?: TimeSlot;
  completionRule?: CompletionRule;
  points?: number;
  requiresApproval?: boolean;
  randomizeItems?: boolean;
  sortOrder?: number;
  items?: { id?: number; label: string; sortOrder: number; shouldArchive?: boolean }[];
}

export interface RoutineService {
  getActiveRoutines(): Routine[];
  getRoutineById(id: number): Routine;
  submitCompletion(data: SubmitCompletionData): RoutineCompletion;
  getPendingCompletionCount(): number;
  listRoutinesAdmin(): Routine[];
  getRoutineAdmin(id: number): Routine;
  createRoutine(data: CreateRoutineData): Routine;
  updateRoutine(id: number, data: UpdateRoutineData): Routine;
  archiveRoutine(id: number): void;
  unarchiveRoutine(id: number): void;
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

interface AdminChecklistItemRow extends ChecklistItemRow {
  archived_at: string | null;
}

function mapRoutineRowAdmin(row: RoutineRow): Routine {
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
    archivedAt: row.archived_at ?? undefined,
  };
}

function mapChecklistItemRowAdmin(row: AdminChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    routineId: row.routine_id,
    label: row.label,
    imageAssetId: row.image_asset_id ?? undefined,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at ?? undefined,
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

  const selectAllRoutinesStmt = db.prepare(
    `SELECT id, name, time_slot, completion_rule, points, requires_approval,
            image_asset_id, randomize_items, active, sort_order, archived_at
     FROM routines
     ORDER BY sort_order ASC`,
  );

  const selectAllItemsForRoutineStmt = db.prepare(
    `SELECT id, routine_id, label, image_asset_id, sort_order, archived_at
     FROM checklist_items
     WHERE routine_id = ?
     ORDER BY sort_order ASC`,
  );

  const selectAllItemsAdminBulkStmt = db.prepare(
    `SELECT ci.id, ci.routine_id, ci.label, ci.image_asset_id, ci.sort_order, ci.archived_at
     FROM checklist_items ci
     ORDER BY ci.routine_id, ci.sort_order ASC`,
  );

  const insertRoutineStmt = db.prepare(
    `INSERT INTO routines (name, time_slot, completion_rule, points, requires_approval, randomize_items, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertChecklistItemStmt = db.prepare(
    `INSERT INTO checklist_items (routine_id, label, sort_order)
     VALUES (?, ?, ?)`,
  );

  const updateRoutineStmt = db.prepare(
    `UPDATE routines SET name = ?, time_slot = ?, completion_rule = ?, points = ?,
            requires_approval = ?, randomize_items = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  const updateChecklistItemStmt = db.prepare(
    `UPDATE checklist_items SET label = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ? AND routine_id = ?`,
  );

  const archiveChecklistItemStmt = db.prepare(
    `UPDATE checklist_items SET archived_at = datetime('now'), active = 0, updated_at = datetime('now')
     WHERE id = ? AND routine_id = ?`,
  );

  const archiveRoutineStmt = db.prepare(
    `UPDATE routines SET archived_at = datetime('now'), active = 0, updated_at = datetime('now')
     WHERE id = ? AND active = 1 AND archived_at IS NULL`,
  );

  const unarchiveRoutineStmt = db.prepare(
    `UPDATE routines SET archived_at = NULL, active = 1, updated_at = datetime('now')
     WHERE id = ? AND active = 0 AND archived_at IS NOT NULL`,
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

  function listRoutinesAdmin(): Routine[] {
    const rows = selectAllRoutinesStmt.all() as RoutineRow[];
    const allItemRows = selectAllItemsAdminBulkStmt.all() as AdminChecklistItemRow[];

    const itemsByRoutineId = new Map<number, ChecklistItem[]>();
    for (const itemRow of allItemRows) {
      let items = itemsByRoutineId.get(itemRow.routine_id);
      if (!items) {
        items = [];
        itemsByRoutineId.set(itemRow.routine_id, items);
      }
      items.push(mapChecklistItemRowAdmin(itemRow));
    }

    return rows.map((row) => {
      const routine = mapRoutineRowAdmin(row);
      routine.items = itemsByRoutineId.get(row.id) ?? [];
      return routine;
    });
  }

  function getRoutineAdmin(id: number): Routine {
    const row = selectRoutineByIdStmt.get(id) as RoutineRow | undefined;
    if (!row) {
      throw new NotFoundError("Routine not found");
    }
    const routine = mapRoutineRowAdmin(row);
    const itemRows = selectAllItemsForRoutineStmt.all(id) as AdminChecklistItemRow[];
    routine.items = itemRows.map(mapChecklistItemRowAdmin);
    return routine;
  }

  function validateRoutineFields(
    timeSlot: TimeSlot | undefined,
    completionRule: CompletionRule | undefined,
    points: number | undefined,
    name?: string,
  ): void {
    if (name !== undefined && name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }
    if (points !== undefined && points < 0) {
      throw new ValidationError("Points must be >= 0");
    }
    if (completionRule === "once_per_slot" && timeSlot === "anytime") {
      throw new ValidationError("once_per_slot is not allowed for anytime time slot");
    }
  }

  const createRoutineTx = db.transaction((data: CreateRoutineData): Routine => {
    validateRoutineFields(data.timeSlot, data.completionRule, data.points, data.name);
    if (data.items.length === 0) {
      throw new ValidationError("At least one checklist item is required");
    }

    const result = insertRoutineStmt.run(
      data.name.trim(),
      data.timeSlot,
      data.completionRule,
      data.points,
      data.requiresApproval ? 1 : 0,
      data.randomizeItems ? 1 : 0,
      data.sortOrder,
    );
    const routineId = Number(result.lastInsertRowid);

    for (const item of data.items) {
      insertChecklistItemStmt.run(routineId, item.label.trim(), item.sortOrder);
    }

    return getRoutineAdmin(routineId);
  });

  function createRoutine(data: CreateRoutineData): Routine {
    return createRoutineTx(data);
  }

  const updateRoutineTx = db.transaction((id: number, data: UpdateRoutineData): Routine => {
    const existing = selectRoutineByIdStmt.get(id) as RoutineRow | undefined;
    if (!existing) {
      throw new NotFoundError("Routine not found");
    }
    if (existing.archived_at !== null) {
      throw new ConflictError("Cannot update an archived routine. Unarchive it first.");
    }

    const newName = data.name !== undefined ? data.name : existing.name;
    const newTimeSlot = (data.timeSlot !== undefined ? data.timeSlot : existing.time_slot) as TimeSlot;
    const newCompletionRule = (data.completionRule !== undefined ? data.completionRule : existing.completion_rule) as CompletionRule;
    const newPoints = data.points !== undefined ? data.points : existing.points;
    const newRequiresApproval = data.requiresApproval !== undefined ? data.requiresApproval : existing.requires_approval === 1;
    const newRandomizeItems = data.randomizeItems !== undefined ? data.randomizeItems : existing.randomize_items === 1;
    const newSortOrder = data.sortOrder !== undefined ? data.sortOrder : existing.sort_order;

    validateRoutineFields(newTimeSlot, newCompletionRule, newPoints, newName);

    updateRoutineStmt.run(
      newName.trim(),
      newTimeSlot,
      newCompletionRule,
      newPoints,
      newRequiresApproval ? 1 : 0,
      newRandomizeItems ? 1 : 0,
      newSortOrder,
      id,
    );

    if (data.items) {
      for (const item of data.items) {
        if (item.id) {
          if (item.shouldArchive) {
            archiveChecklistItemStmt.run(item.id, id);
          } else {
            updateChecklistItemStmt.run(item.label.trim(), item.sortOrder, item.id, id);
          }
        } else {
          insertChecklistItemStmt.run(id, item.label.trim(), item.sortOrder);
        }
      }
    }

    return getRoutineAdmin(id);
  });

  function updateRoutine(id: number, data: UpdateRoutineData): Routine {
    return updateRoutineTx(id, data);
  }

  function archiveRoutine(id: number): void {
    const result = archiveRoutineStmt.run(id);
    if (result.changes === 0) {
      throw new NotFoundError("Routine not found or already archived");
    }
  }

  function unarchiveRoutine(id: number): void {
    const result = unarchiveRoutineStmt.run(id);
    if (result.changes === 0) {
      throw new NotFoundError("Routine not found or not archived");
    }
  }

  return {
    getActiveRoutines,
    getRoutineById,
    submitCompletion,
    getPendingCompletionCount,
    listRoutinesAdmin,
    getRoutineAdmin,
    createRoutine,
    updateRoutine,
    archiveRoutine,
    unarchiveRoutine,
  };
}
