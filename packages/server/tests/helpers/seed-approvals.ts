import type Database from "better-sqlite3";

// Requires seed-routines, seed-chores, and seed-rewards to be run first.
export function seedPendingSubmissions(db: Database.Database): void {
  // Pending routine completion (routine 2 requires approval)
  db.prepare(
    `INSERT INTO routine_completions
       (id, routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot,
        points_snapshot, requires_approval_snapshot, checklist_snapshot_json,
        randomized_order_json, completion_window_key, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    1, 2, "Afternoon Check", "afternoon", "once_per_slot",
    3, 1, null,
    null, "2:once_per_slot:2026-03-23:afternoon", "2026-03-23", "pending", "rc-pending-1",
  );

  // Already-approved routine completion (for double-tap testing)
  db.prepare(
    `INSERT INTO routine_completions
       (id, routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot,
        points_snapshot, requires_approval_snapshot, checklist_snapshot_json,
        randomized_order_json, completion_window_key, local_date, status, idempotency_key,
        review_note, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    2, 1, "Morning Routine", "morning", "once_per_day",
    5, 0, null,
    null, null, "2026-03-22", "approved", "rc-approved-1",
    null, "2026-03-22T10:00:00",
  );

  // Pending chore log (chore 2 "Yard Work" requires approval)
  db.prepare(
    `INSERT INTO chore_logs
       (id, chore_id, chore_name_snapshot, tier_id, tier_name_snapshot, points_snapshot,
        requires_approval_snapshot, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, 2, "Yard Work", 3, "Basic", 10, 1, "2026-03-23", "pending", "cl-pending-1");

  // Already-rejected chore log
  db.prepare(
    `INSERT INTO chore_logs
       (id, chore_id, chore_name_snapshot, tier_id, tier_name_snapshot, points_snapshot,
        requires_approval_snapshot, local_date, status, idempotency_key,
        review_note, reviewed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    2, 1, "Clean Kitchen", 1, "Quick Clean", 3, 0,
    "2026-03-22", "rejected", "cl-rejected-1",
    "Not done properly", "2026-03-22T11:00:00",
  );

  // Pending reward request
  db.prepare(
    `INSERT INTO reward_requests
       (id, reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(1, 1, "Extra Screen Time", 20, "2026-03-23", "pending", "rr-pending-1");

  // Second pending routine completion for testing multiple items
  db.prepare(
    `INSERT INTO routine_completions
       (id, routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot,
        points_snapshot, requires_approval_snapshot, checklist_snapshot_json,
        randomized_order_json, completion_window_key, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    3, 2, "Afternoon Check", "afternoon", "once_per_slot",
    3, 1, null,
    null, "2:once_per_slot:2026-03-22:afternoon", "2026-03-22", "pending", "rc-pending-2",
  );
}

