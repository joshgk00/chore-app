import type Database from "better-sqlite3";
import type { RoutineHealthAnalytics, TimeSlot } from "@chore-app/shared";
import { subtractDays } from "../lib/date-utils.js";

export interface RoutineAnalyticsService {
  getRoutineHealth(localToday: string): RoutineHealthAnalytics;
}

interface ActiveRoutineRow {
  id: number;
  name: string;
  time_slot: string;
}

interface CompletionCountRow {
  routine_id: number;
  days_completed: number;
}

interface SlotCountRow {
  time_slot_snapshot: string;
  completed_count: number;
}

function dayNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
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

  const selectCompletionCountsStmt = db.prepare(
    `SELECT routine_id, COUNT(DISTINCT local_date) AS days_completed
     FROM routine_completions
     WHERE status = 'approved'
       AND local_date >= ? AND local_date <= ?
     GROUP BY routine_id`,
  );

  const selectSlotBreakdownStmt = db.prepare(
    `SELECT time_slot_snapshot, COUNT(*) AS completed_count
     FROM routine_completions
     WHERE status = 'approved'
       AND local_date >= ? AND local_date <= ?
     GROUP BY time_slot_snapshot`,
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

    const completionRows = selectCompletionCountsStmt.all(
      sinceDate,
      localToday,
    ) as CompletionCountRow[];
    const completionMap = new Map(
      completionRows.map((r) => [r.routine_id, r.days_completed]),
    );

    const completionRates = activeRoutines.map((r) => ({
      routineId: r.id,
      routineName: r.name,
      timeSlot: r.time_slot as TimeSlot,
      daysCompleted: completionMap.get(r.id) ?? 0,
      totalDays: WINDOW_DAYS,
    }));

    const slotRows = selectSlotBreakdownStmt.all(
      sinceDate,
      localToday,
    ) as SlotCountRow[];
    const slotCompletionMap = new Map(
      slotRows.map((r) => [r.time_slot_snapshot, r.completed_count]),
    );

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
