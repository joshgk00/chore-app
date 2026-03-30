import type Database from "better-sqlite3";
import type { ChoreEngagementAnalytics } from "@chore-app/shared";
import { subtractDays } from "../lib/date-utils.js";

export interface ChoreAnalyticsService {
  getChoreEngagement(localToday: string): ChoreEngagementAnalytics;
}

interface ActiveChoreRow {
  id: number;
  name: string;
}

interface SubmissionCountRow {
  chore_id: number;
  submission_count: number;
  approved_count: number;
  total_points: number;
}

interface DailyTrendRow {
  local_date: string;
  submissions: number;
}

export function createChoreAnalyticsService(
  db: Database.Database,
): ChoreAnalyticsService {
  const WINDOW_DAYS = 14;

  const selectActiveChoresStmt = db.prepare(
    `SELECT id, name
     FROM chores
     WHERE active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectSubmissionCountsStmt = db.prepare(
    `SELECT cl.chore_id,
            COUNT(*) AS submission_count,
            SUM(CASE WHEN cl.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
            SUM(CASE WHEN cl.status = 'approved' THEN cl.points_snapshot ELSE 0 END) AS total_points
     FROM chore_logs AS cl
     JOIN chores AS c ON c.id = cl.chore_id
     WHERE c.active = 1 AND c.archived_at IS NULL
       AND cl.local_date >= ? AND cl.local_date <= ?
     GROUP BY cl.chore_id`,
  );

  const selectDailyTrendsStmt = db.prepare(
    `SELECT cl.local_date, COUNT(*) AS submissions
     FROM chore_logs AS cl
     JOIN chores AS c ON c.id = cl.chore_id
     WHERE c.active = 1 AND c.archived_at IS NULL
       AND cl.local_date >= ? AND cl.local_date <= ?
     GROUP BY cl.local_date
     ORDER BY cl.local_date`,
  );

  function getChoreEngagement(localToday: string): ChoreEngagementAnalytics {
    const sinceDate = subtractDays(localToday, WINDOW_DAYS - 1);

    const activeChores = selectActiveChoresStmt.all() as ActiveChoreRow[];

    const submissionRows = selectSubmissionCountsStmt.all(
      sinceDate,
      localToday,
    ) as SubmissionCountRow[];
    const submissionMap = new Map(
      submissionRows.map((r) => [r.chore_id, r]),
    );

    const engagementRates = activeChores
      .map((chore) => {
        const stats = submissionMap.get(chore.id);
        return {
          choreId: chore.id,
          choreName: chore.name,
          submissionCount: stats?.submission_count ?? 0,
          approvedCount: stats?.approved_count ?? 0,
          totalPoints: stats?.total_points ?? 0,
        };
      })
      .sort((a, b) => b.submissionCount - a.submissionCount);

    const inactiveChores = activeChores
      .filter((chore) => !submissionMap.has(chore.id))
      .map((chore) => ({ choreId: chore.id, choreName: chore.name }));

    const trendRows = selectDailyTrendsStmt.all(
      sinceDate,
      localToday,
    ) as DailyTrendRow[];
    const submissionTrends = trendRows.map((r) => ({
      date: r.local_date,
      submissions: r.submissions,
    }));

    return { engagementRates, inactiveChores, submissionTrends, windowDays: WINDOW_DAYS };
  }

  return { getChoreEngagement };
}
