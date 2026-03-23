import type Database from "better-sqlite3";

export function seedRewardData(db: Database.Database): void {
  db.prepare(
    `INSERT INTO rewards (id, name, points_cost, active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(1, "Extra Screen Time", 20, 1, 1);

  db.prepare(
    `INSERT INTO rewards (id, name, points_cost, active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(2, "Movie Night Pick", 50, 1, 2);

  db.prepare(
    `INSERT INTO rewards (id, name, points_cost, active, sort_order, archived_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(3, "Old Reward", 10, 0, 3, "2026-01-01T00:00:00");
}

export function seedPointsLedger(db: Database.Database, amount: number): void {
  db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('manual', NULL, NULL, ?, 'Test points')`,
  ).run(amount);
}
