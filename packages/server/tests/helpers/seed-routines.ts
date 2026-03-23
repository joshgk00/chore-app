import type Database from "better-sqlite3";

export function seedRoutineData(db: Database.Database): void {
  db.prepare(
    `INSERT INTO routines (id, name, time_slot, completion_rule, points, requires_approval, randomize_items, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, "Morning Routine", "morning", "once_per_day", 5, 0, 1, 1, 1);
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(1, 1, "Brush teeth", 1, 1);
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(2, 1, "Make bed", 2, 1);
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active, archived_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(3, 1, "Old task", 3, 0, "2026-01-01T00:00:00");

  db.prepare(
    `INSERT INTO routines (id, name, time_slot, completion_rule, points, requires_approval, randomize_items, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(2, "Afternoon Check", "afternoon", "once_per_slot", 3, 1, 0, 1, 2);
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(4, 2, "Clean room", 1, 1);

  db.prepare(
    `INSERT INTO routines (id, name, time_slot, completion_rule, points, requires_approval, randomize_items, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(3, "Quick Win", "anytime", "unlimited", 1, 0, 0, 1, 3);
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(5, 3, "Tidy up", 1, 1);

  db.prepare(
    `INSERT INTO routines (id, name, time_slot, completion_rule, points, requires_approval, randomize_items, active, sort_order, archived_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(4, "Old Routine", "morning", "once_per_day", 2, 0, 0, 0, 4, "2026-01-01T00:00:00");
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(6, 4, "Old task", 1, 1);

  db.prepare(
    `INSERT INTO routines (id, name, time_slot, completion_rule, points, requires_approval, randomize_items, active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(5, "Bedtime Routine", "bedtime", "once_per_day", 4, 0, 0, 1, 5);
  db.prepare(
    `INSERT INTO checklist_items (id, routine_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)`,
  ).run(7, 5, "Brush teeth (night)", 1, 1);
}
