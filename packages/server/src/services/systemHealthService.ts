import type Database from "better-sqlite3";
import type { SystemHealthStats } from "@chore-app/shared";

export interface SystemHealthService {
  getSystemHealth(): SystemHealthStats;
}

interface StatusCountRow {
  status: string;
  count: number;
}

export function createSystemHealthService(
  db: Database.Database,
): SystemHealthService {
  const selectPageCountStmt = db.prepare("PRAGMA page_count");
  const selectPageSizeStmt = db.prepare("PRAGMA page_size");

  const selectActivityCountStmt = db.prepare(
    "SELECT COUNT(*) AS count FROM activity_events",
  );

  const selectLastBackupStmt = db.prepare(
    `SELECT created_at FROM activity_events
     WHERE event_type = ?
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  let hasPushTable: boolean | null = null;

  function pushTableExists(): boolean {
    if (hasPushTable !== null) return hasPushTable;
    const row = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      )
      .get("table", "push_subscriptions") as { name: string } | undefined;
    hasPushTable = !!row;
    return hasPushTable;
  }

  const selectPushCountsByStatusSql =
    "SELECT status, COUNT(*) AS count FROM push_subscriptions GROUP BY status";

  function getSystemHealth(): SystemHealthStats {
    const pageCount = (selectPageCountStmt.get() as { page_count: number })
      .page_count;
    const pageSize = (selectPageSizeStmt.get() as { page_size: number })
      .page_size;
    const databaseSizeBytes = pageCount * pageSize;

    const activityEventCount = (
      selectActivityCountStmt.get() as { count: number }
    ).count;

    const backupRow = selectLastBackupStmt.get("backup_exported") as
      | { created_at: string }
      | undefined;
    const lastBackupAt = backupRow?.created_at ?? null;

    const pushSubscriptions = { active: 0, expired: 0, failed: 0 };
    if (pushTableExists()) {
      const rows = db
        .prepare(selectPushCountsByStatusSql)
        .all() as StatusCountRow[];
      for (const row of rows) {
        if (row.status === "active") pushSubscriptions.active = row.count;
        else if (row.status === "expired") pushSubscriptions.expired = row.count;
        else if (row.status === "failed") pushSubscriptions.failed = row.count;
      }
    }

    return {
      databaseSizeBytes,
      activityEventCount,
      lastBackupAt,
      pushSubscriptions,
    };
  }

  return { getSystemHealth };
}
