import type Database from "better-sqlite3";
import type { RewardDemandAnalytics } from "@chore-app/shared";

export interface RewardAnalyticsService {
  getRewardDemand(): RewardDemandAnalytics;
}

interface PendingSummaryRow {
  pending_count: number;
  pending_total_cost: number;
}

interface RequestRankingRow {
  reward_id: number;
  reward_name: string;
  request_count: number;
  approved_count: number;
  total_cost: number;
}

interface ActiveRewardRow {
  id: number;
  name: string;
}

interface PointsSumRow {
  total: number;
}

export function createRewardAnalyticsService(
  db: Database.Database,
): RewardAnalyticsService {
  const selectPendingSummaryStmt = db.prepare(
    `SELECT COUNT(*) AS pending_count,
            COALESCE(SUM(cost_snapshot), 0) AS pending_total_cost
     FROM reward_requests
     WHERE status = 'pending'`,
  );

  const selectRequestRankingsStmt = db.prepare(
    `SELECT rr.reward_id,
            rr.reward_name_snapshot AS reward_name,
            COUNT(*) AS request_count,
            SUM(CASE WHEN rr.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
            SUM(CASE WHEN rr.status = 'approved' THEN rr.cost_snapshot ELSE 0 END) AS total_cost
     FROM reward_requests AS rr
     GROUP BY rr.reward_id
     ORDER BY request_count DESC`,
  );

  const selectActiveRewardsStmt = db.prepare(
    `SELECT id, name
     FROM rewards
     WHERE active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectPointsEarnedStmt = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM points_ledger
     WHERE amount > 0`,
  );

  const selectPointsRedeemedStmt = db.prepare(
    `SELECT COALESCE(SUM(cost_snapshot), 0) AS total
     FROM reward_requests
     WHERE status = 'approved'`,
  );

  function getRewardDemand(): RewardDemandAnalytics {
    const pendingSummary = selectPendingSummaryStmt.get() as PendingSummaryRow;

    const rankingRows = selectRequestRankingsStmt.all() as RequestRankingRow[];
    const requestedRewardIds = new Set(rankingRows.map((r) => r.reward_id));

    const rankings = rankingRows.map((r) => ({
      rewardId: r.reward_id,
      rewardName: r.reward_name,
      requestCount: r.request_count,
      approvedCount: r.approved_count,
      totalCost: r.total_cost,
    }));

    const activeRewards = selectActiveRewardsStmt.all() as ActiveRewardRow[];
    const neverRequested = activeRewards
      .filter((r) => !requestedRewardIds.has(r.id))
      .map((r) => ({ rewardId: r.id, rewardName: r.name }));

    const pointsEarned = (selectPointsEarnedStmt.get() as PointsSumRow).total;
    const pointsRedeemed = (selectPointsRedeemedStmt.get() as PointsSumRow).total;

    return {
      pendingCount: pendingSummary.pending_count,
      pendingTotalCost: pendingSummary.pending_total_cost,
      rankings,
      neverRequested,
      pointsEarned,
      pointsRedeemed,
    };
  }

  return { getRewardDemand };
}
