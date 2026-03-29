import type Database from "better-sqlite3";
import type { RoutineHealthAnalytics, TimeSlot } from "@chore-app/shared";

export interface RoutineAnalyticsService {
  getRoutineHealth(localToday: string): RoutineHealthAnalytics;
}

interface ActiveRoutineRow {
  id: number;
  name: string;
  time_slot: string;
}

interface CompletionRow {
  routine_id: number;
  time_slot_snapshot: string;
  days_completed: number;
  completed_count: number;
}

function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

function subtractDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d) - days * 86400000;
  const dt = new Date(ms);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function createRoutineAnalyticsService(
  db: Database.Database,
): RoutineAnalyticsService {
  const selectActiveRoutinesStmt = db.prepare(
    `SELECT id, name, time_slot
     FROM routines
     WHERE active = 1 AND archived_at IS NULL
     ORDER BY sort_order ASC`,
  );

  const selectCompletionsStmt = db.prepare(
    `SELECT routine_id, time_slot_snapshot,
            COUNT(DISTINCT local_date) AS days_completed,
            COUNT(*) AS completed_count
     FROM routine_completions
     WHERE status = 'approved'
       AND local_date >= ?
     GROUP BY routine_id, time_slot_snapshot`,
  );

  const selectConsecutiveDaysStmt = db.prepare(
    `SELECT DISTINCT local_date
     FROM routine_completions
     WHERE status = 'approved'
     ORDER BY local_date DESC
     LIMIT 30`,
  );

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

  function getRoutineHealth(localToday: string): RoutineHealthAnalytics {
    const WINDOW_DAYS = 7;
    const sinceDate = subtractDays(localToday, WINDOW_DAYS - 1);

    const activeRoutines = selectActiveRoutinesStmt.all() as ActiveRoutineRow[];

    const completionRows = selectCompletionsStmt.all(sinceDate) as CompletionRow[];

    const completionDaysMap = new Map<number, number>();
    const slotCompletionMap = new Map<string, number>();
    for (const row of completionRows) {
      completionDaysMap.set(
        row.routine_id,
        (completionDaysMap.get(row.routine_id) ?? 0) + row.days_completed,
      );
      slotCompletionMap.set(
        row.time_slot_snapshot,
        (slotCompletionMap.get(row.time_slot_snapshot) ?? 0) +
          row.completed_count,
      );
    }

    const completionRates = activeRoutines.map((r) => ({
      routineId: r.id,
      routineName: r.name,
      timeSlot: r.time_slot as TimeSlot,
      daysCompleted: completionDaysMap.get(r.id) ?? 0,
      totalDays: WINDOW_DAYS,
    }));

    const routineCountBySlot = new Map<string, number>();
    for (const r of activeRoutines) {
      const slot = r.time_slot;
      routineCountBySlot.set(slot, (routineCountBySlot.get(slot) ?? 0) + 1);
    }

    const allSlots: TimeSlot[] = ["morning", "afternoon", "bedtime", "anytime"];
    const timeSlotBreakdown = allSlots
      .filter(
        (slot) =>
          routineCountBySlot.has(slot) || slotCompletionMap.has(slot),
      )
      .map((slot) => ({
        timeSlot: slot,
        completedCount: slotCompletionMap.get(slot) ?? 0,
        routineCount: routineCountBySlot.get(slot) ?? 0,
      }));

    const streakDays = getConsecutiveStreakDays();

    return { completionRates, timeSlotBreakdown, streakDays };
  }

  return { getRoutineHealth };
}
