import type Database from "better-sqlite3";
import type { Statement } from "better-sqlite3";
import type {
  RoutineCompletion,
  ChoreLog,
  RewardRequest,
  PendingApprovals,
  Status,
} from "@chore-app/shared";
import { ConflictError, NotFoundError } from "../lib/errors.js";
import type { ActivityService } from "./activityService.js";
import type { BadgeService } from "./badgeService.js";
import type { PushService } from "./pushService.js";

export interface ApprovalService {
  getPendingApprovals(): PendingApprovals;
  approveRoutineCompletion(id: number, reviewNote?: string, bonusPoints?: number): RoutineCompletion;
  rejectRoutineCompletion(id: number, reviewNote?: string): RoutineCompletion;
  approveChoreLog(id: number, reviewNote?: string, bonusPoints?: number): ChoreLog;
  rejectChoreLog(id: number, reviewNote?: string): ChoreLog;
  approveRewardRequest(id: number, reviewNote?: string): RewardRequest;
  rejectRewardRequest(id: number, reviewNote?: string): RewardRequest;
}

interface CompletionRow {
  id: number;
  routine_id: number;
  routine_name_snapshot: string;
  time_slot_snapshot: string;
  completion_rule_snapshot: string;
  points_snapshot: number;
  requires_approval_snapshot: number;
  checklist_snapshot_json: string | null;
  randomized_order_json: string | null;
  completion_window_key: string | null;
  completed_at: string;
  local_date: string;
  status: string;
  idempotency_key: string;
  review_note: string | null;
  reviewed_at: string | null;
}

interface ChoreLogRow {
  id: number;
  chore_id: number;
  chore_name_snapshot: string;
  tier_id: number;
  tier_name_snapshot: string;
  points_snapshot: number;
  requires_approval_snapshot: number;
  logged_at: string;
  local_date: string;
  status: string;
  idempotency_key: string;
  review_note: string | null;
  reviewed_at: string | null;
}

interface RequestRow {
  id: number;
  reward_id: number;
  reward_name_snapshot: string;
  cost_snapshot: number;
  requested_at: string;
  local_date: string;
  status: string;
  idempotency_key: string;
  review_note: string | null;
  reviewed_at: string | null;
}

function mapCompletionRow(row: CompletionRow): RoutineCompletion {
  return {
    id: row.id,
    routineId: row.routine_id,
    routineNameSnapshot: row.routine_name_snapshot,
    timeSlotSnapshot: row.time_slot_snapshot,
    completionRuleSnapshot: row.completion_rule_snapshot,
    pointsSnapshot: row.points_snapshot,
    requiresApprovalSnapshot: row.requires_approval_snapshot === 1,
    checklistSnapshotJson: row.checklist_snapshot_json,
    randomizedOrderJson: row.randomized_order_json,
    completionWindowKey: row.completion_window_key,
    completedAt: row.completed_at,
    localDate: row.local_date,
    status: row.status as Status,
    idempotencyKey: row.idempotency_key,
    reviewNote: row.review_note ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

function mapChoreLogRow(row: ChoreLogRow): ChoreLog {
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
    reviewNote: row.review_note ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

function mapRequestRow(row: RequestRow): RewardRequest {
  return {
    id: row.id,
    rewardId: row.reward_id,
    rewardNameSnapshot: row.reward_name_snapshot,
    costSnapshot: row.cost_snapshot,
    requestedAt: row.requested_at,
    localDate: row.local_date,
    status: row.status as Status,
    idempotencyKey: row.idempotency_key,
    reviewNote: row.review_note ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

export function createApprovalService(
  db: Database.Database,
  activityService: ActivityService,
  badgeService?: BadgeService,
  pushService?: PushService,
): ApprovalService {
  const selectPendingCompletionsStmt = db.prepare(
    `SELECT id, routine_id, routine_name_snapshot, time_slot_snapshot,
            completion_rule_snapshot, points_snapshot, requires_approval_snapshot,
            checklist_snapshot_json, randomized_order_json, completion_window_key,
            completed_at, local_date, status, idempotency_key, review_note, reviewed_at
     FROM routine_completions
     WHERE status = 'pending'
     ORDER BY completed_at ASC`,
  );

  const selectPendingChoreLogsStmt = db.prepare(
    `SELECT id, chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
            points_snapshot, requires_approval_snapshot, logged_at, local_date,
            status, idempotency_key, review_note, reviewed_at
     FROM chore_logs
     WHERE status = 'pending'
     ORDER BY logged_at ASC`,
  );

  const selectPendingRequestsStmt = db.prepare(
    `SELECT id, reward_id, reward_name_snapshot, cost_snapshot, requested_at,
            local_date, status, idempotency_key, review_note, reviewed_at
     FROM reward_requests
     WHERE status = 'pending'
     ORDER BY requested_at ASC`,
  );

  const selectCompletionByIdStmt = db.prepare(
    `SELECT id, routine_id, routine_name_snapshot, time_slot_snapshot,
            completion_rule_snapshot, points_snapshot, requires_approval_snapshot,
            checklist_snapshot_json, randomized_order_json, completion_window_key,
            completed_at, local_date, status, idempotency_key, review_note, reviewed_at
     FROM routine_completions
     WHERE id = ?`,
  );

  const updateCompletionStatusStmt = db.prepare(
    `UPDATE routine_completions
     SET status = ?, review_note = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
  );

  const insertRoutineLedgerStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('routine', 'routine_completions', ?, ?, ?)`,
  );

  const selectChoreLogByIdStmt = db.prepare(
    `SELECT id, chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
            points_snapshot, requires_approval_snapshot, logged_at, local_date,
            status, idempotency_key, review_note, reviewed_at
     FROM chore_logs
     WHERE id = ?`,
  );

  const updateChoreLogStatusStmt = db.prepare(
    `UPDATE chore_logs
     SET status = ?, review_note = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
  );

  const insertChoreLedgerStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('chore', 'chore_logs', ?, ?, ?)`,
  );

  const selectRequestByIdStmt = db.prepare(
    `SELECT id, reward_id, reward_name_snapshot, cost_snapshot, requested_at,
            local_date, status, idempotency_key, review_note, reviewed_at
     FROM reward_requests
     WHERE id = ?`,
  );

  const updateRequestStatusStmt = db.prepare(
    `UPDATE reward_requests
     SET status = ?, review_note = ?, reviewed_at = datetime('now')
     WHERE id = ?`,
  );

  const insertRewardLedgerStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('reward', 'reward_requests', ?, ?, ?)`,
  );

  const insertBonusLedgerStmt = db.prepare(
    `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
     VALUES ('bonus', ?, ?, ?, ?)`,
  );

  function insertBonusIfPositive(
    referenceTable: string,
    referenceId: number,
    bonusPoints: number | undefined,
    entityName: string,
  ): number {
    if (bonusPoints === undefined || bonusPoints <= 0) return 0;
    if (!Number.isInteger(bonusPoints)) return 0;
    insertBonusLedgerStmt.run(referenceTable, referenceId, bonusPoints, `Bonus: ${entityName}`);
    return bonusPoints;
  }

  function formatBonusText(bonus: number): string {
    return bonus > 0 ? ` (+${bonus} bonus)` : "";
  }

  function formatApprovalNotificationBody(basePoints: number, bonus: number): string {
    if (basePoints > 0) return `+${basePoints} points${formatBonusText(bonus)}`;
    if (bonus > 0) return `+${bonus} bonus points`;
    return "Great job!";
  }

  function loadPendingRecord<T extends { status: string }>(
    stmt: Statement,
    id: number,
    notFoundMessage: string,
  ): T {
    const row = stmt.get(id) as T | undefined;
    if (!row) throw new NotFoundError(notFoundMessage);
    if (row.status !== "pending") throw new ConflictError("Already processed");
    return row;
  }

  function getPendingApprovals(): PendingApprovals {
    const completionRows = selectPendingCompletionsStmt.all() as CompletionRow[];
    const choreLogRows = selectPendingChoreLogsStmt.all() as ChoreLogRow[];
    const requestRows = selectPendingRequestsStmt.all() as RequestRow[];

    return {
      routineCompletions: completionRows.map(mapCompletionRow),
      choreLogs: choreLogRows.map(mapChoreLogRow),
      rewardRequests: requestRows.map(mapRequestRow),
    };
  }

  const approveRoutineCompletionTx = db.transaction(
    (id: number, reviewNote?: string, bonusPoints?: number): RoutineCompletion => {
      const row = loadPendingRecord<CompletionRow>(selectCompletionByIdStmt, id, "Routine completion not found");
      updateCompletionStatusStmt.run("approved", reviewNote ?? null, id);

      insertRoutineLedgerStmt.run(
        id,
        row.points_snapshot,
        `Completed: ${row.routine_name_snapshot}`,
      );

      const bonus = insertBonusIfPositive("routine_completions", id, bonusPoints, row.routine_name_snapshot);

      badgeService?.evaluateBadges();

      activityService.recordActivityOrThrow({
        eventType: "routine_approved",
        entityType: "routine_completion",
        entityId: id,
        summary: `Approved ${row.routine_name_snapshot} for ${row.points_snapshot} points${formatBonusText(bonus)}`,
      });

      const updated = selectCompletionByIdStmt.get(id) as CompletionRow;
      return mapCompletionRow(updated);
    },
  );

  function approveRoutineCompletion(id: number, reviewNote?: string, bonusPoints?: number): RoutineCompletion {
    const result = approveRoutineCompletionTx(id, reviewNote, bonusPoints);
    const bonus = bonusPoints && bonusPoints > 0 ? bonusPoints : 0;
    const body = formatApprovalNotificationBody(result.pointsSnapshot, bonus);
    pushService?.sendNotificationSafe("child", {
      title: `${result.routineNameSnapshot} approved!`,
      body,
      data: { type: "routine_completion", id: result.id, action: "approved" },
    }, { entityType: "approval", id: result.id });
    return result;
  }

  const rejectRoutineCompletionTx = db.transaction(
    (id: number, reviewNote?: string): RoutineCompletion => {
      const row = loadPendingRecord<CompletionRow>(selectCompletionByIdStmt, id, "Routine completion not found");
      updateCompletionStatusStmt.run("rejected", reviewNote ?? null, id);

      activityService.recordActivityOrThrow({
        eventType: "routine_rejected",
        entityType: "routine_completion",
        entityId: id,
        summary: `Rejected ${row.routine_name_snapshot}`,
      });

      const updated = selectCompletionByIdStmt.get(id) as CompletionRow;
      return mapCompletionRow(updated);
    },
  );

  function rejectRoutineCompletion(id: number, reviewNote?: string): RoutineCompletion {
    const result = rejectRoutineCompletionTx(id, reviewNote);
    pushService?.sendNotificationSafe("child", {
      title: `${result.routineNameSnapshot} needs revision`,
      body: reviewNote || "Check with your parent",
      data: { type: "routine_completion", id: result.id, action: "rejected" },
    }, { entityType: "approval", id: result.id });
    return result;
  }

  const approveChoreLogTx = db.transaction(
    (id: number, reviewNote?: string, bonusPoints?: number): ChoreLog => {
      const row = loadPendingRecord<ChoreLogRow>(selectChoreLogByIdStmt, id, "Chore log not found");
      updateChoreLogStatusStmt.run("approved", reviewNote ?? null, id);

      insertChoreLedgerStmt.run(
        id,
        row.points_snapshot,
        `Chore: ${row.chore_name_snapshot} (${row.tier_name_snapshot})`,
      );

      const bonus = insertBonusIfPositive("chore_logs", id, bonusPoints, row.chore_name_snapshot);

      badgeService?.evaluateBadges();

      activityService.recordActivityOrThrow({
        eventType: "chore_approved",
        entityType: "chore_log",
        entityId: id,
        summary: `Approved ${row.chore_name_snapshot} (${row.tier_name_snapshot}) for ${row.points_snapshot} points${formatBonusText(bonus)}`,
      });

      const updated = selectChoreLogByIdStmt.get(id) as ChoreLogRow;
      return mapChoreLogRow(updated);
    },
  );

  function approveChoreLog(id: number, reviewNote?: string, bonusPoints?: number): ChoreLog {
    const result = approveChoreLogTx(id, reviewNote, bonusPoints);
    const bonus = bonusPoints && bonusPoints > 0 ? bonusPoints : 0;
    const body = formatApprovalNotificationBody(result.pointsSnapshot, bonus);
    pushService?.sendNotificationSafe("child", {
      title: `${result.choreNameSnapshot} approved!`,
      body,
      data: { type: "chore_log", id: result.id, action: "approved" },
    }, { entityType: "approval", id: result.id });
    return result;
  }

  const rejectChoreLogTx = db.transaction(
    (id: number, reviewNote?: string): ChoreLog => {
      const row = loadPendingRecord<ChoreLogRow>(selectChoreLogByIdStmt, id, "Chore log not found");
      updateChoreLogStatusStmt.run("rejected", reviewNote ?? null, id);

      activityService.recordActivityOrThrow({
        eventType: "chore_rejected",
        entityType: "chore_log",
        entityId: id,
        summary: `Rejected ${row.chore_name_snapshot}`,
      });

      const updated = selectChoreLogByIdStmt.get(id) as ChoreLogRow;
      return mapChoreLogRow(updated);
    },
  );

  function rejectChoreLog(id: number, reviewNote?: string): ChoreLog {
    const result = rejectChoreLogTx(id, reviewNote);
    pushService?.sendNotificationSafe("child", {
      title: `${result.choreNameSnapshot} needs revision`,
      body: reviewNote || "Check with your parent",
      data: { type: "chore_log", id: result.id, action: "rejected" },
    }, { entityType: "approval", id: result.id });
    return result;
  }

  const approveRewardRequestTx = db.transaction(
    (id: number, reviewNote?: string): RewardRequest => {
      const row = loadPendingRecord<RequestRow>(selectRequestByIdStmt, id, "Reward request not found");
      updateRequestStatusStmt.run("approved", reviewNote ?? null, id);

      insertRewardLedgerStmt.run(
        id,
        -row.cost_snapshot,
        `Redeemed: ${row.reward_name_snapshot}`,
      );

      badgeService?.evaluateBadges();

      activityService.recordActivityOrThrow({
        eventType: "reward_approved",
        entityType: "reward_request",
        entityId: id,
        summary: `Approved ${row.reward_name_snapshot} for ${row.cost_snapshot} points`,
      });

      const updated = selectRequestByIdStmt.get(id) as RequestRow;
      return mapRequestRow(updated);
    },
  );

  function approveRewardRequest(id: number, reviewNote?: string): RewardRequest {
    const result = approveRewardRequestTx(id, reviewNote);
    pushService?.sendNotificationSafe("child", {
      title: `${result.rewardNameSnapshot} approved!`,
      body: `Enjoy your reward!`,
      data: { type: "reward_request", id: result.id, action: "approved" },
    }, { entityType: "approval", id: result.id });
    return result;
  }

  const rejectRewardRequestTx = db.transaction(
    (id: number, reviewNote?: string): RewardRequest => {
      const row = loadPendingRecord<RequestRow>(selectRequestByIdStmt, id, "Reward request not found");
      updateRequestStatusStmt.run("rejected", reviewNote ?? null, id);

      activityService.recordActivityOrThrow({
        eventType: "reward_rejected",
        entityType: "reward_request",
        entityId: id,
        summary: `Rejected ${row.reward_name_snapshot}`,
      });

      const updated = selectRequestByIdStmt.get(id) as RequestRow;
      return mapRequestRow(updated);
    },
  );

  function rejectRewardRequest(id: number, reviewNote?: string): RewardRequest {
    const result = rejectRewardRequestTx(id, reviewNote);
    pushService?.sendNotificationSafe("child", {
      title: `${result.rewardNameSnapshot} not approved`,
      body: reviewNote || "Check with your parent",
      data: { type: "reward_request", id: result.id, action: "rejected" },
    }, { entityType: "approval", id: result.id });
    return result;
  }

  return {
    getPendingApprovals,
    approveRoutineCompletion,
    rejectRoutineCompletion,
    approveChoreLog,
    rejectChoreLog,
    approveRewardRequest,
    rejectRewardRequest,
  };
}
