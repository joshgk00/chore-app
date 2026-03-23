import type Database from "better-sqlite3";

export function seedChoreData(db: Database.Database): void {
  db.prepare(
    `INSERT INTO chores (id, name, requires_approval, active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(1, "Clean Kitchen", 0, 1, 1);
  db.prepare(
    `INSERT INTO chore_tiers (id, chore_id, name, points, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(1, 1, "Quick Clean", 3, 1, 1);
  db.prepare(
    `INSERT INTO chore_tiers (id, chore_id, name, points, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(2, 1, "Deep Clean", 5, 2, 1);

  db.prepare(
    `INSERT INTO chores (id, name, requires_approval, active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(2, "Yard Work", 1, 1, 2);
  db.prepare(
    `INSERT INTO chore_tiers (id, chore_id, name, points, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(3, 2, "Basic", 10, 1, 1);

  db.prepare(
    `INSERT INTO chores (id, name, requires_approval, active, sort_order, archived_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(3, "Old Chore", 0, 0, 3, "2026-01-01T00:00:00");
  db.prepare(
    `INSERT INTO chore_tiers (id, chore_id, name, points, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(4, 3, "Standard", 2, 1, 1);

  db.prepare(
    `INSERT INTO chores (id, name, requires_approval, active, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(4, "Laundry", 0, 1, 4);
  db.prepare(
    `INSERT INTO chore_tiers (id, chore_id, name, points, sort_order, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(5, 4, "Wash & Fold", 4, 1, 1);
  db.prepare(
    `INSERT INTO chore_tiers (id, chore_id, name, points, sort_order, active, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(6, 4, "Old Tier", 1, 2, 0, "2026-01-01T00:00:00");
}
