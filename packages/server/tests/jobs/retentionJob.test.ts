import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb } from "../db-helpers.js";
import { purgeExpiredActivityEvents } from "../../src/jobs/retentionJob.js";

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
    "activity_retention_days",
    "30",
  );
});

afterEach(() => {
  db.close();
});

function insertActivityEvent(createdAt: string): void {
  db.prepare(
    "INSERT INTO activity_events (event_type, created_at) VALUES (?, ?)",
  ).run("test_event", createdAt);
}

function insertPointsLedgerEntry(createdAt: string): void {
  db.prepare(
    "INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run("chore", "chore_logs", 1, 10, createdAt);
}

function countRows(table: string): number {
  const row = db.prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}

describe("purgeExpiredActivityEvents", () => {
  it("deletes activity events older than the retention period", () => {
    insertActivityEvent("2020-01-01 00:00:00");
    insertActivityEvent("2020-06-01 00:00:00");

    const deleted = purgeExpiredActivityEvents(db);

    expect(deleted).toBe(2);
    expect(countRows("activity_events")).toBe(0);
  });

  it("preserves events within the retention period", () => {
    const recent = new Date().toISOString().replace("T", " ").slice(0, 19);
    insertActivityEvent(recent);
    insertActivityEvent("2020-01-01 00:00:00");

    const deleted = purgeExpiredActivityEvents(db);

    expect(deleted).toBe(1);
    expect(countRows("activity_events")).toBe(1);
  });

  it("does not delete points_ledger entries regardless of age", () => {
    insertPointsLedgerEntry("2020-01-01 00:00:00");
    insertActivityEvent("2020-01-01 00:00:00");

    purgeExpiredActivityEvents(db);

    expect(countRows("points_ledger")).toBe(1);
    expect(countRows("activity_events")).toBe(0);
  });

  it("does not delete routine_completions", () => {
    db.prepare(
      `INSERT INTO routines (name, time_slot, completion_rule, points, requires_approval, active) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("Test Routine", "morning", "once_per_day", 10, 0, 1);
    db.prepare(
      `INSERT INTO routine_completions (routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot, points_snapshot, requires_approval_snapshot, status, local_date, idempotency_key, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, "Test Routine", "morning", "once_per_day", 10, 0, "approved", "2020-01-01", "key-1", "2020-01-01 00:00:00");

    purgeExpiredActivityEvents(db);

    expect(countRows("routine_completions")).toBe(1);
  });

  it("does not delete chore_logs", () => {
    db.prepare(
      `INSERT INTO chores (name, active) VALUES (?, ?)`,
    ).run("Test Chore", 1);
    db.prepare(
      `INSERT INTO chore_tiers (chore_id, name, points, sort_order) VALUES (?, ?, ?, ?)`,
    ).run(1, "Basic", 5, 0);
    db.prepare(
      `INSERT INTO chore_logs (chore_id, tier_id, chore_name_snapshot, tier_name_snapshot, points_snapshot, requires_approval_snapshot, status, local_date, idempotency_key, logged_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, 1, "Test Chore", "Basic", 5, 0, "approved", "2020-01-01", "key-2", "2020-01-01 00:00:00");

    purgeExpiredActivityEvents(db);

    expect(countRows("chore_logs")).toBe(1);
  });

  it("does not delete reward_requests", () => {
    db.prepare(
      `INSERT INTO rewards (name, points_cost, active) VALUES (?, ?, ?)`,
    ).run("Test Reward", 50, 1);
    db.prepare(
      `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, status, local_date, idempotency_key, requested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(1, "Test Reward", 50, "pending", "2020-01-01", "key-3", "2020-01-01 00:00:00");

    purgeExpiredActivityEvents(db);

    expect(countRows("reward_requests")).toBe(1);
  });

  it("does not delete badges_earned", () => {
    db.prepare(
      `INSERT INTO badges_earned (badge_key, earned_at) VALUES (?, ?)`,
    ).run("first_routine", "2020-01-01 00:00:00");

    purgeExpiredActivityEvents(db);

    expect(countRows("badges_earned")).toBe(1);
  });

  it("handles empty activity_events table without error", () => {
    const deleted = purgeExpiredActivityEvents(db);

    expect(deleted).toBe(0);
    expect(countRows("activity_events")).toBe(0);
  });

  it("respects changed retention_days setting", () => {
    insertActivityEvent("2020-01-01 00:00:00");
    const recent = new Date().toISOString().replace("T", " ").slice(0, 19);
    insertActivityEvent(recent);

    db.prepare("UPDATE settings SET value = ? WHERE key = ?").run(
      "1",
      "activity_retention_days",
    );

    purgeExpiredActivityEvents(db);

    expect(countRows("activity_events")).toBe(1);
  });

  it("defaults to 365 days when setting is missing", () => {
    db.prepare("DELETE FROM settings WHERE key = ?").run(
      "activity_retention_days",
    );

    const twoYearsAgo = new Date(
      Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    );
    const twoYearsAgoStr = twoYearsAgo
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    insertActivityEvent(twoYearsAgoStr);

    const sixMonthsAgo = new Date(
      Date.now() - 180 * 24 * 60 * 60 * 1000,
    );
    const sixMonthsAgoStr = sixMonthsAgo
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);
    insertActivityEvent(sixMonthsAgoStr);

    const deleted = purgeExpiredActivityEvents(db);

    expect(deleted).toBe(1);
    expect(countRows("activity_events")).toBe(1);
  });
});
