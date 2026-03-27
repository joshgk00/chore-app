import type Database from "better-sqlite3";
import { getLogger } from "../lib/logger.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionJobHandle {
  stop(): void;
}

export function createRetentionPurger(db: Database.Database) {
  const selectRetentionStmt = db.prepare(
    "SELECT value FROM settings WHERE key = ?",
  );
  const deleteExpiredStmt = db.prepare(
    "DELETE FROM activity_events WHERE created_at < datetime('now', ?)",
  );

  return function purgeExpiredActivityEvents(): number {
    const retentionRow = selectRetentionStmt.get("activity_retention_days") as
      | { value: string }
      | undefined;

    const parsed = retentionRow ? Number(retentionRow.value) : NaN;
    const retentionDays = Number.isInteger(parsed) && parsed >= 1 ? parsed : 365;

    const result = deleteExpiredStmt.run(`-${retentionDays} days`);
    return result.changes;
  };
}

export function purgeExpiredActivityEvents(db: Database.Database): number {
  return createRetentionPurger(db)();
}

export function startRetentionJob(db: Database.Database): RetentionJobHandle {
  const purge = createRetentionPurger(db);

  function runPurge() {
    try {
      const deleted = purge();
      if (deleted > 0) {
        getLogger().info({ deleted }, "retention job: purged expired activity events");
      }
    } catch (err) {
      getLogger().error({ err }, "retention job failed");
    }
  }

  runPurge();
  const intervalId = setInterval(runPurge, ONE_DAY_MS);
  intervalId.unref();

  return {
    stop() {
      clearInterval(intervalId);
    },
  };
}
