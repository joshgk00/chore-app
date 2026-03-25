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
import type { PushService } from "./pushService.js";

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
  imageAssetId?: number | null;
  items: { label: string; sortOrder: number; imageAssetId?: number | null }[];
}

export interface UpdateRoutineData {
  name?: string;
  timeSlot?: TimeSlot;
  completionRule?: CompletionRule;
  points?: number;
  requiresApproval?: boolean;
  randomizeItems?: boolean;
  sortOrder?: number;
  imageAssetId?: number | null;
  items?: { id?: number; label: string; sortOrder: number; shouldArchive?: boolean; imageAssetId?: number | null }[];
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
  asset_stored_filename: string | null;
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
  asset_stored_filename: string | null;
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
    imageUrl: row.asset_stored_filename ? `/assets/${row.asset_stored_filename}` : undefined,
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
    imageUrl: row.asset_stored_filename ? `/assets/${row.asset_stored_filename}` : undefined,
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
    imageUrl: row.asset_stored_filename ? `/assets/${row.asset_stored_filename}` : undefined,
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
    imageUrl: row.asset_stored_filename ? `/assets/${row.asset_stored_filename}` : undefined,
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
  pushService?: PushService,
): RoutineService {
  const selectActiveRoutinesStmt = db.prepare(
    `SELECT r.id, r.name, r.time_slot, r.completion_rule, r.points, r.requires_approval,
            r.image_asset_id, a.stored_filename AS asset_stored_filename,
            r.randomize_items, r.active, r.sort_order, r.archived_at
     FROM routines r
     LEFT JOIN assets a ON r.image_asset_id = a.id
     WHERE r.active = 1 AND r.archived_at IS NULL
     ORDER BY r.sort_order ASC`,
  );

  const selectActiveItemsStmt = db.prepare(
    `SELECT ci.id, ci.routine_id, ci.label, ci.image_asset_id,
            a.stored_filename AS asset_stored_filename, ci.sort_order
     FROM checklist_items ci
     LEFT JOIN assets a ON ci.image_asset_id = a.id
     WHERE ci.routine_id = ? AND ci.active = 1 AND ci.archived_at IS NULL
     ORDER BY ci.sort_order ASC`,
  );

  const selectAllActiveItemsStmt = db.prepare(
    `SELECT ci.id, ci.routine_id, ci.label, ci.image_asset_id,
            a.stored_filename AS asset_stored_filename, ci.sort_order
     FROM checklist_items ci
     INNER JOIN routines r ON ci.routine_id = r.id
     LEFT JOIN assets a ON ci.image_asset_id = a.id
     WHERE ci.active = 1 AND ci.archived_at IS NULL
       AND r.active = 1 AND r.archived_at IS NULL
     ORDER BY ci.routine_id, ci.sort_order ASC`,
  );

  const selectRoutineByIdStmt = db.prepare(
    `SELECT r.id, r.name, r.time_slot, r.completion_rule, r.points, r.requires_approval,
            r.image_asset_id, a.stored_filename AS asset_stored_filename,
            r.randomize_items, r.active, r.sort_order, r.archived_at
     FROM routines r
     LEFT JOIN assets a ON r.image_asset_id = a.id
     WHERE r.id = ?`,
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
    `SELECT r.id, r.name, r.time_slot, r.completion_rule, r.points, r.requires_approval,
            r.image_asset_id, a.stored_filename AS asset_stored_filename,
            r.randomize_items, r.active, r.sort_order, r.archived_at
     FROM routines r
     LEFT JOIN assets a ON r.image_asset_id = a.id
     ORDER BY r.sort_order ASC`,
  );

  const selectAllItemsForRoutineStmt = db.prepare(
    `SELECT ci.id, ci.routine_id, ci.label, ci.image_asset_id,
            a.stored_filename AS asset_stored_filename, ci.sort_order, ci.archived_at
     FROM checklist_items ci
     LEFT JOIN assets a ON ci.image_asset_id = a.id
     WHERE ci.routine_id = ?
     ORDER BY ci.sort_order ASC`,
  );

  const selectAllItemsAdminBulkStmt = db.prepare(
    `SELECT ci.id, ci.routine_id, ci.label, ci.image_asset_id,
            a.stored_filename AS asset_stored_filename, ci.sort_order, ci.archived_at
     FROM checklist_items ci
     LEFT JOIN assets a ON ci.image_asset_id = a.id
     ORDER BY ci.routine_id, ci.sort_order ASC`,
  );

  const insertRoutineStmt = db.prepare(
    `INSERT INTO routines (name, time_slot, completion_rule, points, requires_approval, randomize_items, sort_order, image_asset_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertChecklistItemStmt = db.prepare(
    `INSERT INTO checklist_items (routine_id, label, sort_order, image_asset_id)
     VALUES (?, ?, ?, ?)`,
  );

  const updateRoutineStmt = db.prepare(
    `UPDATE routines SET name = ?, time_slot = ?, completion_rule = ?, points = ?,
            requires_approval = ?, randomize_items = ?, sort_order = ?, image_asset_id = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  const updateChecklistItemStmt = db.prepare(
    `UPDATE checklist_items SET label = ?, sort_order = ?, image_asset_id = ?, updated_at = datetime('now')
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

  const selectAssetExistsStmt = db.prepare(
    `SELECT id, archived_at FROM assets WHERE id = ?`,
  );

  const selectItemImageAssetIdStmt = db.prepare(
    `SELECT image_asset_id FROM checklist_items WHERE id = ? AND routine_id = ?`,
  );

  function validateAssetId(assetId: number | null | undefined): void {
    if (assetId == null) return;
    const asset = selectAssetExistsStmt.get(assetId) as { id: number; archived_at: string | null } | undefined;
    if (!asset) {
      throw new ValidationError("Referenced asset does not exist");
    }
    if (asset.archived_at !== null) {
      throw new ValidationError("Referenced asset is archived");
    }
  }

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
    const result = submitCompletionTx(data);

    if (result.status === "pending") {
      try {
        pushService?.sendNotification("admin", {
          title: "Routine submitted for review",
          body: `${result.routineNameSnapshot} needs approval`,
          data: { type: "routine_completion", id: result.id },
        });
      } catch { /* side-effect — never crash the primary operation */ }
    }

    return result;
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
    validateAssetId(data.imageAssetId);
    for (const item of data.items) {
      validateAssetId(item.imageAssetId);
    }

    const result = insertRoutineStmt.run(
      data.name.trim(),
      data.timeSlot,
      data.completionRule,
      data.points,
      data.requiresApproval ? 1 : 0,
      data.randomizeItems ? 1 : 0,
      data.sortOrder,
      data.imageAssetId ?? null,
    );
    const routineId = Number(result.lastInsertRowid);

    for (const item of data.items) {
      insertChecklistItemStmt.run(routineId, item.label.trim(), item.sortOrder, item.imageAssetId ?? null);
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
    const newImageAssetId = data.imageAssetId !== undefined ? data.imageAssetId : existing.image_asset_id;
    validateAssetId(newImageAssetId);

    validateRoutineFields(newTimeSlot, newCompletionRule, newPoints, newName);

    updateRoutineStmt.run(
      newName.trim(),
      newTimeSlot,
      newCompletionRule,
      newPoints,
      newRequiresApproval ? 1 : 0,
      newRandomizeItems ? 1 : 0,
      newSortOrder,
      newImageAssetId,
      id,
    );

    if (data.items) {
      for (const item of data.items) {
        if (item.id) {
          if (item.shouldArchive) {
            archiveChecklistItemStmt.run(item.id, id);
          } else {
            const existingItem = selectItemImageAssetIdStmt.get(item.id, id) as { image_asset_id: number | null } | undefined;
            const itemImageAssetId = item.imageAssetId !== undefined ? item.imageAssetId : (existingItem?.image_asset_id ?? null);
            validateAssetId(itemImageAssetId);
            updateChecklistItemStmt.run(item.label.trim(), item.sortOrder, itemImageAssetId, item.id, id);
          }
        } else {
          validateAssetId(item.imageAssetId);
          insertChecklistItemStmt.run(id, item.label.trim(), item.sortOrder, item.imageAssetId ?? null);
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
