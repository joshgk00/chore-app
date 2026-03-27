import type Database from "better-sqlite3";
import type { PointsBalance, LedgerEntry, EntryType } from "@chore-app/shared";
import { ValidationError } from "../lib/errors.js";
import type { ActivityService } from "./activityService.js";

export interface PointsService {
  getBalance(): PointsBalance;
  getLedgerFiltered(options: { limit: number; offset: number; entryType?: EntryType }): LedgerEntry[];
  createAdjustment(amount: number, note: string): LedgerEntry;
}

interface LedgerRow {
  id: number;
  entry_type: string;
  reference_table: string | null;
  reference_id: number | null;
  amount: number;
  note: string | null;
  created_at: string;
}

function mapLedgerRow(row: LedgerRow): LedgerEntry {
  return {
    id: row.id,
    entryType: row.entry_type as EntryType,
    referenceTable: row.reference_table,
    referenceId: row.reference_id,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function createPointsService(db: Database.Database, activityService: ActivityService): PointsService {
  const selectTotalStmt = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM points_ledger`,
  );

  const selectReservedStmt = db.prepare(
    `SELECT COALESCE(SUM(cost_snapshot), 0) as reserved
     FROM reward_requests
     WHERE status = 'pending'`,
  );

  const selectLedgerStmt = db.prepare(
    `SELECT id, entry_type, reference_table, reference_id, amount, note, created_at
     FROM points_ledger
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
  );

  const selectLedgerByTypeStmt = db.prepare(
    `SELECT id, entry_type, reference_table, reference_id, amount, note, created_at
     FROM points_ledger
     WHERE entry_type = ?
     ORDER BY created_at DESC, id DESC
     LIMIT ? OFFSET ?`,
  );

  const insertAdjustmentStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('manual', NULL, NULL, ?, ?)`,
  );

  const selectLedgerByIdStmt = db.prepare(
    `SELECT id, entry_type, reference_table, reference_id, amount, note, created_at
     FROM points_ledger WHERE id = ?`,
  );

  function getBalance(): PointsBalance {
    const totalRow = selectTotalStmt.get() as { total: number };
    const reservedRow = selectReservedStmt.get() as { reserved: number };
    const total = totalRow.total;
    const reserved = reservedRow.reserved;
    return { total, reserved, available: total - reserved };
  }

  function getLedgerFiltered(options: { limit: number; offset: number; entryType?: EntryType }): LedgerEntry[] {
    const safeLimit = Math.max(1, Math.min(options.limit, 100));
    const safeOffset = Math.max(0, options.offset);

    if (options.entryType) {
      const rows = selectLedgerByTypeStmt.all(options.entryType, safeLimit, safeOffset) as LedgerRow[];
      return rows.map(mapLedgerRow);
    }

    const rows = selectLedgerStmt.all(safeLimit, safeOffset) as LedgerRow[];
    return rows.map(mapLedgerRow);
  }

  const createAdjustmentTx = db.transaction((amount: number, trimmedNote: string): LedgerEntry => {
    const result = insertAdjustmentStmt.run(amount, trimmedNote);
    const inserted = selectLedgerByIdStmt.get(result.lastInsertRowid) as LedgerRow;

    activityService.recordActivityOrThrow({
      eventType: "manual_adjustment",
      entityType: "points_ledger",
      entityId: Number(result.lastInsertRowid),
      summary: `Manual adjustment: ${amount > 0 ? "+" : ""}${amount} points — ${trimmedNote}`,
    });

    return mapLedgerRow(inserted);
  });

  function createAdjustment(amount: number, note: string): LedgerEntry {
    if (!Number.isInteger(amount) || amount === 0) {
      throw new ValidationError("amount must be a non-zero integer");
    }
    if (amount > 999999 || amount < -999999) {
      throw new ValidationError("amount must be between -999999 and 999999");
    }
    if (!note || note.trim().length === 0) {
      throw new ValidationError("note is required for manual adjustments");
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length > 500) {
      throw new ValidationError("note must be 500 characters or fewer");
    }

    return createAdjustmentTx(amount, trimmedNote);
  }

  return { getBalance, getLedgerFiltered, createAdjustment };
}
