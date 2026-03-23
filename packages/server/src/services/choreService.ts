import type Database from "better-sqlite3";
import type { Chore, ChoreTier, ChoreLog, Status } from "@chore-app/shared";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import type { ActivityService } from "./activityService.js";
import type { BadgeService } from "./badgeService.js";

export interface SubmitChoreLogData {
  choreId: number;
  tierId: number;
  idempotencyKey: string;
  localDate: string;
}

export interface ChoreService {
  getActiveChores(): Chore[];
  submitChoreLog(data: SubmitChoreLogData): ChoreLog;
  cancelChoreLog(logId: number): ChoreLog;
  getPendingChoreLogCount(): number;
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

  return { getActiveChores, submitChoreLog, cancelChoreLog, getPendingChoreLogCount };
}
