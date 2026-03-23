import type Database from "better-sqlite3";
import type { Chore, ChoreTier, ChoreLog, Status } from "@chore-app/shared";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors.js";
import type { ActivityService } from "./activityService.js";
import type { BadgeService } from "./badgeService.js";

export interface SubmitChoreLogData {
  choreId: number;
  tierId: number;
  idempotencyKey: string;
  localDate: string;
}

export interface CreateChoreData {
  name: string;
  requiresApproval: boolean;
  sortOrder: number;
  tiers: { name: string; points: number; sortOrder: number }[];
}

export interface UpdateChoreData {
  name?: string;
  requiresApproval?: boolean;
  sortOrder?: number;
  tiers?: { id?: number; name: string; points: number; sortOrder: number; shouldArchive?: boolean }[];
}

export interface ChoreService {
  getActiveChores(): Chore[];
  submitChoreLog(data: SubmitChoreLogData): ChoreLog;
  cancelChoreLog(logId: number): ChoreLog;
  getPendingChoreLogCount(): number;
  listChoresAdmin(): Chore[];
  getChoreAdmin(id: number): Chore;
  createChore(data: CreateChoreData): Chore;
  updateChore(id: number, data: UpdateChoreData): Chore;
  archiveChore(id: number): void;
  unarchiveChore(id: number): void;
}

interface ChoreRow {
  id: number;
  name: string;
  requires_approval: number;
  active: number;
  sort_order: number;
  archived_at: string | null;
}

interface TierRow {
  id: number;
  chore_id: number;
  name: string;
  points: number;
  sort_order: number;
  active: number;
  archived_at: string | null;
}

interface ChoreLogRow {
  id: number;
  chore_id: number;
  chore_name_snapshot: string;
  tier_id: number | null;
  tier_name_snapshot: string | null;
  points_snapshot: number;
  requires_approval_snapshot: number;
  logged_at: string;
  local_date: string;
  status: string;
  idempotency_key: string;
}

function mapChoreRow(row: ChoreRow): Chore {
  return {
    id: row.id,
    name: row.name,
    requiresApproval: row.requires_approval === 1,
    sortOrder: row.sort_order,
    tiers: [],
  };
}

function mapTierRow(row: TierRow): ChoreTier {
  return {
    id: row.id,
    choreId: row.chore_id,
    name: row.name,
    points: row.points,
    sortOrder: row.sort_order,
  };
}

interface AdminTierRow extends TierRow {
  archived_at: string | null;
}

function mapChoreRowAdmin(row: ChoreRow): Chore {
  return {
    id: row.id,
    name: row.name,
    requiresApproval: row.requires_approval === 1,
    sortOrder: row.sort_order,
    tiers: [],
    archivedAt: row.archived_at ?? undefined,
  };
}

function mapTierRowAdmin(row: AdminTierRow): ChoreTier {
  return {
    id: row.id,
    choreId: row.chore_id,
    name: row.name,
    points: row.points,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at ?? undefined,
  };
}

function mapChoreLogRow(row: ChoreLogRow): ChoreLog {
  if (row.tier_id == null || row.tier_name_snapshot == null) {
    throw new Error(
      `Chore log ${row.id} is missing tier data (tier_id or tier_name_snapshot is NULL)`,
    );
  }

  return {
    id: row.id,
    choreId: row.chore_id,
    choreNameSnapshot: row.chore_name_snapshot,
    tierId: row.tier_id,
    tierNameSnapshot: row.tier_name_snapshot,
    pointsSnapshot: row.points_snapshot,
    requiresApprovalSnapshot: row.requires_approval_snapshot === 1,
    loggedAt: row.logged_at,
    localDate: row.local_date,
    status: row.status as Status,
    idempotencyKey: row.idempotency_key,
  };
}

export function createChoreService(
  db: Database.Database,
  activityService: ActivityService,
  badgeService?: BadgeService,
): ChoreService {
  const selectActiveChoresStmt = db.prepare(
    `SELECT id, name, requires_approval, active, sort_order, archived_at
     FROM chores
     WHERE active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectAllActiveTiersStmt = db.prepare(
    `SELECT ct.id, ct.chore_id, ct.name, ct.points, ct.sort_order, ct.active, ct.archived_at
     FROM chore_tiers ct
     INNER JOIN chores c ON ct.chore_id = c.id
     WHERE ct.active = 1 AND ct.archived_at IS NULL
       AND c.active = 1 AND c.archived_at IS NULL
     ORDER BY ct.chore_id, ct.sort_order ASC`,
  );

  const selectChoreByIdStmt = db.prepare(
    `SELECT id, name, requires_approval, active, sort_order, archived_at
     FROM chores
     WHERE id = ?`,
  );

  const selectTierByIdStmt = db.prepare(
    `SELECT id, chore_id, name, points, sort_order, active, archived_at
     FROM chore_tiers
     WHERE id = ?`,
  );

  const selectLogByKeyStmt = db.prepare(
    `SELECT id, chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
            points_snapshot, requires_approval_snapshot, logged_at, local_date,
            status, idempotency_key
     FROM chore_logs
     WHERE idempotency_key = ?`,
  );

  const insertLogStmt = db.prepare(
    `INSERT INTO chore_logs
       (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot, points_snapshot,
        requires_approval_snapshot, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const selectLogByIdStmt = db.prepare(
    `SELECT id, chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
            points_snapshot, requires_approval_snapshot, logged_at, local_date,
            status, idempotency_key
     FROM chore_logs
     WHERE id = ?`,
  );

  const insertLedgerStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('chore', 'chore_logs', ?, ?, ?)`,
  );

  const updateLogStatusStmt = db.prepare(
    `UPDATE chore_logs SET status = ? WHERE id = ?`,
  );

  const countPendingStmt = db.prepare(
    `SELECT COUNT(*) as count FROM chore_logs WHERE status = 'pending'`,
  );

  const selectAllChoresStmt = db.prepare(
    `SELECT id, name, requires_approval, active, sort_order, archived_at
     FROM chores
     ORDER BY sort_order ASC`,
  );

  const selectAllTiersForChoreStmt = db.prepare(
    `SELECT id, chore_id, name, points, sort_order, active, archived_at
     FROM chore_tiers
     WHERE chore_id = ?
     ORDER BY sort_order ASC`,
  );

  const selectAllTiersAdminBulkStmt = db.prepare(
    `SELECT ct.id, ct.chore_id, ct.name, ct.points, ct.sort_order, ct.active, ct.archived_at
     FROM chore_tiers ct
     ORDER BY ct.chore_id, ct.sort_order ASC`,
  );

  const insertChoreStmt = db.prepare(
    `INSERT INTO chores (name, requires_approval, sort_order)
     VALUES (?, ?, ?)`,
  );

  const insertTierStmt = db.prepare(
    `INSERT INTO chore_tiers (chore_id, name, points, sort_order)
     VALUES (?, ?, ?, ?)`,
  );

  const updateChoreStmt = db.prepare(
    `UPDATE chores SET name = ?, requires_approval = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ?`,
  );

  const updateTierStmt = db.prepare(
    `UPDATE chore_tiers SET name = ?, points = ?, sort_order = ?, updated_at = datetime('now')
     WHERE id = ? AND chore_id = ?`,
  );

  const archiveTierStmt = db.prepare(
    `UPDATE chore_tiers SET archived_at = datetime('now'), active = 0, updated_at = datetime('now')
     WHERE id = ? AND chore_id = ?`,
  );

  const archiveChoreStmt = db.prepare(
    `UPDATE chores SET archived_at = datetime('now'), active = 0, updated_at = datetime('now')
     WHERE id = ? AND active = 1 AND archived_at IS NULL`,
  );

  const unarchiveChoreStmt = db.prepare(
    `UPDATE chores SET archived_at = NULL, active = 1, updated_at = datetime('now')
     WHERE id = ? AND active = 0 AND archived_at IS NOT NULL`,
  );

  function getActiveChores(): Chore[] {
    const rows = selectActiveChoresStmt.all() as ChoreRow[];
    const allTierRows = selectAllActiveTiersStmt.all() as TierRow[];

    const tiersByChoreId = new Map<number, ChoreTier[]>();
    for (const tierRow of allTierRows) {
      let tiers = tiersByChoreId.get(tierRow.chore_id);
      if (!tiers) {
        tiers = [];
        tiersByChoreId.set(tierRow.chore_id, tiers);
      }
      tiers.push(mapTierRow(tierRow));
    }

    return rows.map((row) => {
      const chore = mapChoreRow(row);
      chore.tiers = tiersByChoreId.get(row.id) ?? [];
      return chore;
    });
  }

  const submitChoreLogTx = db.transaction((data: SubmitChoreLogData): ChoreLog => {
    const existingLog = selectLogByKeyStmt.get(
      data.idempotencyKey,
    ) as ChoreLogRow | undefined;
    if (existingLog) {
      return mapChoreLogRow(existingLog);
    }

    const chore = selectChoreByIdStmt.get(data.choreId) as ChoreRow | undefined;
    if (!chore || chore.active === 0 || chore.archived_at !== null) {
      throw new ConflictError("archived");
    }

    const tier = selectTierByIdStmt.get(data.tierId) as TierRow | undefined;
    if (!tier || tier.active === 0 || tier.archived_at !== null) {
      throw new ConflictError("archived");
    }
    if (tier.chore_id !== data.choreId) {
      throw new ConflictError("tier_chore_mismatch");
    }

    const status = chore.requires_approval === 1 ? "pending" : "approved";

    let logId: number;
    try {
      const result = insertLogStmt.run(
        data.choreId,
        chore.name,
        data.tierId,
        tier.name,
        tier.points,
        chore.requires_approval,
        data.localDate,
        status,
        data.idempotencyKey,
      );
      logId = Number(result.lastInsertRowid);
    } catch (err: unknown) {
      const sqliteErr = err as { code?: string; message?: string };
      if (
        (sqliteErr.code === "SQLITE_CONSTRAINT_UNIQUE" ||
          sqliteErr.code === "SQLITE_CONSTRAINT") &&
        sqliteErr.message?.includes("idempotency_key")
      ) {
        const existing = selectLogByKeyStmt.get(
          data.idempotencyKey,
        ) as ChoreLogRow;
        return mapChoreLogRow(existing);
      }
      throw err;
    }

    if (status === "approved") {
      insertLedgerStmt.run(
        logId,
        tier.points,
        `Chore: ${chore.name} (${tier.name})`,
      );
      badgeService?.evaluateBadges({ type: "chore_log" });
    }

    activityService.recordActivityOrThrow({
      eventType: "chore_submitted",
      entityType: "chore_log",
      entityId: logId,
      summary: `Logged ${chore.name} (${tier.name}) for ${tier.points} points`,
    });

    const inserted = selectLogByIdStmt.get(logId) as ChoreLogRow;
    return mapChoreLogRow(inserted);
  });

  function submitChoreLog(data: SubmitChoreLogData): ChoreLog {
    return submitChoreLogTx(data);
  }

  const cancelChoreLogTx = db.transaction((logId: number): ChoreLog => {
    const log = selectLogByIdStmt.get(logId) as ChoreLogRow | undefined;
    if (!log) {
      throw new NotFoundError("Chore log not found");
    }

    if (log.status === "canceled") {
      return mapChoreLogRow(log);
    }

    if (log.status === "approved" || log.status === "rejected") {
      throw new ConflictError("cannot_cancel");
    }

    updateLogStatusStmt.run("canceled", logId);

    activityService.recordActivityOrThrow({
      eventType: "chore_canceled",
      entityType: "chore_log",
      entityId: logId,
      summary: `Canceled chore: ${log.chore_name_snapshot}`,
    });

    const updated = selectLogByIdStmt.get(logId) as ChoreLogRow;
    return mapChoreLogRow(updated);
  });

  function cancelChoreLog(logId: number): ChoreLog {
    return cancelChoreLogTx(logId);
  }

  function getPendingChoreLogCount(): number {
    const row = countPendingStmt.get() as { count: number };
    return row.count;
  }

  function listChoresAdmin(): Chore[] {
    const rows = selectAllChoresStmt.all() as ChoreRow[];
    const allTierRows = selectAllTiersAdminBulkStmt.all() as AdminTierRow[];

    const tiersByChoreId = new Map<number, ChoreTier[]>();
    for (const tierRow of allTierRows) {
      let tiers = tiersByChoreId.get(tierRow.chore_id);
      if (!tiers) {
        tiers = [];
        tiersByChoreId.set(tierRow.chore_id, tiers);
      }
      tiers.push(mapTierRowAdmin(tierRow));
    }

    return rows.map((row) => {
      const chore = mapChoreRowAdmin(row);
      chore.tiers = tiersByChoreId.get(row.id) ?? [];
      return chore;
    });
  }

  function getChoreAdmin(id: number): Chore {
    const row = selectChoreByIdStmt.get(id) as ChoreRow | undefined;
    if (!row) {
      throw new NotFoundError("Chore not found");
    }
    const chore = mapChoreRowAdmin(row);
    const tierRows = selectAllTiersForChoreStmt.all(id) as AdminTierRow[];
    chore.tiers = tierRows.map(mapTierRowAdmin);
    return chore;
  }

  const createChoreTx = db.transaction((data: CreateChoreData): Chore => {
    if (data.name.trim().length === 0) {
      throw new ValidationError("Name is required");
    }
    if (data.tiers.length === 0) {
      throw new ValidationError("At least one tier is required");
    }
    for (const tier of data.tiers) {
      if (tier.name.trim().length === 0) {
        throw new ValidationError("Tier name is required");
      }
      if (typeof tier.points !== "number" || !Number.isFinite(tier.points) || !Number.isInteger(tier.points)) {
        throw new ValidationError("Tier points must be a finite integer");
      }
      if (tier.points < 0) {
        throw new ValidationError("Tier points must be >= 0");
      }
    }

    const result = insertChoreStmt.run(
      data.name.trim(),
      data.requiresApproval ? 1 : 0,
      data.sortOrder,
    );
    const choreId = Number(result.lastInsertRowid);

    for (const tier of data.tiers) {
      insertTierStmt.run(choreId, tier.name.trim(), tier.points, tier.sortOrder);
    }

    return getChoreAdmin(choreId);
  });

  function createChore(data: CreateChoreData): Chore {
    return createChoreTx(data);
  }

  const updateChoreTx = db.transaction((id: number, data: UpdateChoreData): Chore => {
    const existing = selectChoreByIdStmt.get(id) as ChoreRow | undefined;
    if (!existing) {
      throw new NotFoundError("Chore not found");
    }
    if (existing.archived_at !== null) {
      throw new ConflictError("Cannot update an archived chore. Unarchive it first.");
    }

    const newName = data.name !== undefined ? data.name : existing.name;
    const newRequiresApproval = data.requiresApproval !== undefined ? data.requiresApproval : existing.requires_approval === 1;
    const newSortOrder = data.sortOrder !== undefined ? data.sortOrder : existing.sort_order;

    if (newName.trim().length === 0) {
      throw new ValidationError("Name is required");
    }

    updateChoreStmt.run(
      newName.trim(),
      newRequiresApproval ? 1 : 0,
      newSortOrder,
      id,
    );

    if (data.tiers) {
      for (const tier of data.tiers) {
        if (tier.id) {
          if (tier.shouldArchive) {
            archiveTierStmt.run(tier.id, id);
          } else {
            if (!tier.name || tier.name.trim().length === 0) {
              throw new ValidationError("Each tier must have a non-empty name");
            }
            if (typeof tier.points !== "number" || !Number.isInteger(tier.points) || tier.points < 0) {
              throw new ValidationError("Each tier must have points >= 0");
            }
            updateTierStmt.run(tier.name.trim(), tier.points, tier.sortOrder, tier.id, id);
          }
        } else {
          if (!tier.name || tier.name.trim().length === 0) {
            throw new ValidationError("Each tier must have a non-empty name");
          }
          if (typeof tier.points !== "number" || !Number.isInteger(tier.points) || tier.points < 0) {
            throw new ValidationError("Each tier must have points >= 0");
          }
          insertTierStmt.run(id, tier.name.trim(), tier.points, tier.sortOrder);
        }
      }
    }

    return getChoreAdmin(id);
  });

  function updateChore(id: number, data: UpdateChoreData): Chore {
    return updateChoreTx(id, data);
  }

  function archiveChore(id: number): void {
    const result = archiveChoreStmt.run(id);
    if (result.changes === 0) {
      throw new NotFoundError("Chore not found or already archived");
    }
  }

  function unarchiveChore(id: number): void {
    const result = unarchiveChoreStmt.run(id);
    if (result.changes === 0) {
      throw new NotFoundError("Chore not found or not archived");
    }
  }

  return {
    getActiveChores,
    submitChoreLog,
    cancelChoreLog,
    getPendingChoreLogCount,
    listChoresAdmin,
    getChoreAdmin,
    createChore,
    updateChore,
    archiveChore,
    unarchiveChore,
  };
}
