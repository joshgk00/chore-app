import type Database from "better-sqlite3";
import type { Badge } from "@chore-app/shared";
import { BADGE_KEYS } from "@chore-app/shared";
import { dayNumber } from "../lib/date-utils.js";

export interface BadgeService {
  getEarnedBadges(): Badge[];
  getRecentBadges(limit?: number): Badge[];
  evaluateBadges(): void;
}

interface BadgeRow {
  id: number;
  badge_key: string;
  earned_at: string;
}

function mapBadgeRow(row: BadgeRow): Badge {
  return {
    id: row.id,
    badgeKey: row.badge_key,
    earnedAt: row.earned_at,
  };
}

export function createBadgeService(db: Database.Database): BadgeService {
  const selectAllBadgesStmt = db.prepare(
    `SELECT id, badge_key, earned_at
     FROM badges_earned
     ORDER BY earned_at DESC, id DESC`,
  );

  const selectRecentBadgesStmt = db.prepare(
    `SELECT id, badge_key, earned_at
     FROM badges_earned
     ORDER BY earned_at DESC, id DESC
     LIMIT ?`,
  );

  const selectBadgeByKeyStmt = db.prepare(
    `SELECT id FROM badges_earned WHERE badge_key = ?`,
  );

  const insertBadgeStmt = db.prepare(
    `INSERT OR IGNORE INTO badges_earned (badge_key) VALUES (?)`,
  );

  const countRoutineCompletionsStmt = db.prepare(
    `SELECT COUNT(*) as count FROM routine_completions WHERE status = 'approved'`,
  );

  const countChoreLogsStmt = db.prepare(
    `SELECT COUNT(*) as count FROM chore_logs WHERE status = 'approved'`,
  );

  const selectConsecutiveDaysStmt = db.prepare(
    `SELECT DISTINCT local_date
     FROM routine_completions
     WHERE status = 'approved'
     ORDER BY local_date DESC
     LIMIT 30`,
  );

  const selectAvailablePointsStmt = db.prepare(
    `SELECT
       COALESCE((SELECT SUM(amount) FROM points_ledger), 0)
       - COALESCE((SELECT SUM(cost_snapshot) FROM reward_requests WHERE status = 'pending'), 0)
       AS available`,
  );

  const countApprovedRewardsStmt = db.prepare(
    `SELECT COUNT(*) as count FROM reward_requests WHERE status = 'approved'`,
  );

  const countHelpTierChoreLogsStmt = db.prepare(
    `SELECT COUNT(*) as count
     FROM chore_logs
     WHERE status = 'approved'
       AND LOWER(tier_name_snapshot) LIKE '%help%'`,
  );

  const countAloneTierChoreLogsStmt = db.prepare(
    `SELECT COUNT(*) as count
     FROM chore_logs
     WHERE status = 'approved'
       AND LOWER(tier_name_snapshot) LIKE '%alone%'`,
  );

  function getEarnedBadges(): Badge[] {
    const rows = selectAllBadgesStmt.all() as BadgeRow[];
    return rows.map(mapBadgeRow);
  }

  function getRecentBadges(limit = 3): Badge[] {
    const safeLimit = Math.max(1, Math.min(limit, 20));
    const rows = selectRecentBadgesStmt.all(safeLimit) as BadgeRow[];
    return rows.map(mapBadgeRow);
  }

  function hasBadge(key: string): boolean {
    return selectBadgeByKeyStmt.get(key) !== undefined;
  }

  function awardBadge(key: string): void {
    insertBadgeStmt.run(key);
  }

  function getConsecutiveStreakDays(): number {
    const rows = selectConsecutiveDaysStmt.all() as { local_date: string }[];
    if (rows.length === 0) return 0;

    let streak = 1;
    for (let i = 1; i < rows.length; i++) {
      const currentDay = dayNumber(rows[i - 1].local_date);
      const previousDay = dayNumber(rows[i].local_date);

      if (currentDay - previousDay === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function evaluateBadges(): void {
    if (!hasBadge(BADGE_KEYS.FIRST_STEP)) {
      const { count } = countRoutineCompletionsStmt.get() as { count: number };
      if (count >= 1) {
        awardBadge(BADGE_KEYS.FIRST_STEP);
      }
    }

    // Compute streak once for both streak badges
    const needsStreakCheck =
      !hasBadge(BADGE_KEYS.ON_A_ROLL) || !hasBadge(BADGE_KEYS.WEEK_WARRIOR);
    if (needsStreakCheck) {
      const streak = getConsecutiveStreakDays();
      if (!hasBadge(BADGE_KEYS.ON_A_ROLL) && streak >= 3) {
        awardBadge(BADGE_KEYS.ON_A_ROLL);
      }
      if (!hasBadge(BADGE_KEYS.WEEK_WARRIOR) && streak >= 7) {
        awardBadge(BADGE_KEYS.WEEK_WARRIOR);
      }
    }

    if (!hasBadge(BADGE_KEYS.CHORE_CHAMPION)) {
      const { count } = countChoreLogsStmt.get() as { count: number };
      if (count >= 10) {
        awardBadge(BADGE_KEYS.CHORE_CHAMPION);
      }
    }

    // Uses available balance (total - pending reservations), not raw total
    if (!hasBadge(BADGE_KEYS.POINT_HOARDER)) {
      const { available } = selectAvailablePointsStmt.get() as { available: number };
      if (available >= 100) {
        awardBadge(BADGE_KEYS.POINT_HOARDER);
      }
    }

    if (!hasBadge(BADGE_KEYS.HELPING_HAND)) {
      const { count } = countHelpTierChoreLogsStmt.get() as { count: number };
      if (count >= 5) {
        awardBadge(BADGE_KEYS.HELPING_HAND);
      }
    }

    if (!hasBadge(BADGE_KEYS.SOLO_ACT)) {
      const { count } = countAloneTierChoreLogsStmt.get() as { count: number };
      if (count >= 5) {
        awardBadge(BADGE_KEYS.SOLO_ACT);
      }
    }

    if (!hasBadge(BADGE_KEYS.BIG_SPENDER)) {
      const { count } = countApprovedRewardsStmt.get() as { count: number };
      if (count >= 1) {
        awardBadge(BADGE_KEYS.BIG_SPENDER);
      }
    }
  }

  return { getEarnedBadges, getRecentBadges, evaluateBadges };
}
