import type Database from "better-sqlite3";
import type { Badge } from "@chore-app/shared";
import { BADGE_KEYS } from "@chore-app/shared";

export interface BadgeEvaluationContext {
  type: "routine_completion" | "chore_log";
}

export interface BadgeService {
  getEarnedBadges(): Badge[];
  getRecentBadges(limit?: number): Badge[];
  evaluateBadges(context: BadgeEvaluationContext): void;
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
     ORDER BY local_date DESC`,
  );

  const selectTotalPointsStmt = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM points_ledger`,
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
      const current = new Date(rows[i - 1].local_date + "T00:00:00");
      const previous = new Date(rows[i].local_date + "T00:00:00");
      const diffMs = current.getTime() - previous.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  function checkPerfectWeek(): boolean {
    const rows = selectConsecutiveDaysStmt.all() as { local_date: string }[];
    if (rows.length < 7) return false;

    let consecutiveDays = 1;
    for (let i = 1; i < rows.length; i++) {
      const current = new Date(rows[i - 1].local_date + "T00:00:00");
      const previous = new Date(rows[i].local_date + "T00:00:00");
      const diffMs = current.getTime() - previous.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays === 1) {
        consecutiveDays++;
        if (consecutiveDays >= 7) return true;
      } else {
        consecutiveDays = 1;
      }
    }
    return consecutiveDays >= 7;
  }

  function evaluateBadges(_context: BadgeEvaluationContext): void {
    // FIRST_STEP: first approved routine completion
    if (!hasBadge(BADGE_KEYS.FIRST_STEP)) {
      const { count } = countRoutineCompletionsStmt.get() as { count: number };
      if (count >= 1) {
        awardBadge(BADGE_KEYS.FIRST_STEP);
      }
    }

    // ON_A_ROLL: 3 consecutive days with a routine completion
    if (!hasBadge(BADGE_KEYS.ON_A_ROLL)) {
      const streak = getConsecutiveStreakDays();
      if (streak >= 3) {
        awardBadge(BADGE_KEYS.ON_A_ROLL);
      }
    }

    // WEEK_WARRIOR: 7 consecutive days with a routine completion
    if (!hasBadge(BADGE_KEYS.WEEK_WARRIOR)) {
      const streak = getConsecutiveStreakDays();
      if (streak >= 7) {
        awardBadge(BADGE_KEYS.WEEK_WARRIOR);
      }
    }

    // SOLO_ACT: perfect week (7 consecutive days)
    if (!hasBadge(BADGE_KEYS.SOLO_ACT)) {
      if (checkPerfectWeek()) {
        awardBadge(BADGE_KEYS.SOLO_ACT);
      }
    }

    // CHORE_CHAMPION: 10+ approved chore logs
    if (!hasBadge(BADGE_KEYS.CHORE_CHAMPION)) {
      const { count } = countChoreLogsStmt.get() as { count: number };
      if (count >= 10) {
        awardBadge(BADGE_KEYS.CHORE_CHAMPION);
      }
    }

    // HELPING_HAND: 5+ distinct days with approved chore logs
    if (!hasBadge(BADGE_KEYS.HELPING_HAND)) {
      const { count } = db
        .prepare(
          `SELECT COUNT(DISTINCT local_date) as count
           FROM chore_logs
           WHERE status = 'approved'`,
        )
        .get() as { count: number };
      if (count >= 5) {
        awardBadge(BADGE_KEYS.HELPING_HAND);
      }
    }

    // POINT_HOARDER: total points crosses 100
    if (!hasBadge(BADGE_KEYS.POINT_HOARDER)) {
      const { total } = selectTotalPointsStmt.get() as { total: number };
      if (total >= 100) {
        awardBadge(BADGE_KEYS.POINT_HOARDER);
      }
    }

    // BIG_SPENDER: total points crosses 500
    if (!hasBadge(BADGE_KEYS.BIG_SPENDER)) {
      const { total } = selectTotalPointsStmt.get() as { total: number };
      if (total >= 500) {
        awardBadge(BADGE_KEYS.BIG_SPENDER);
      }
    }
  }

  return { getEarnedBadges, getRecentBadges, evaluateBadges };
}
