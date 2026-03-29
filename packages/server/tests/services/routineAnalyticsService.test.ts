import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, seedTestData } from "../db-helpers.js";
import { seedRoutineData } from "../helpers/seed-routines.js";
import { createRoutineAnalyticsService } from "../../src/services/routineAnalyticsService.js";
import type { RoutineAnalyticsService } from "../../src/services/routineAnalyticsService.js";

const LOCAL_TODAY = "2026-03-29";

function insertCompletion(
  db: Database.Database,
  routineId: number,
  localDate: string,
  status = "approved",
): void {
  db.prepare(
    `INSERT INTO routine_completions
       (routine_id, routine_name_snapshot, time_slot_snapshot,
        completion_rule_snapshot, points_snapshot, requires_approval_snapshot,
        local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    routineId,
    `Routine ${routineId}`,
    routineId === 2 ? "afternoon" : routineId === 3 ? "anytime" : routineId === 5 ? "bedtime" : "morning",
    "once_per_day",
    5,
    0,
    localDate,
    status,
    `key-${routineId}-${localDate}-${status}-${Math.random()}`,
  );
}

describe("routineAnalyticsService", () => {
  let db: Database.Database;
  let service: RoutineAnalyticsService;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestData(db);
    seedRoutineData(db);
    service = createRoutineAnalyticsService(db);
  });

  describe("completionRates", () => {
    it("returns rates for all active routines", () => {
      const result = service.getRoutineHealth(LOCAL_TODAY);

      // seedRoutineData creates 4 routines: ids 1,2,3,5 active; id 4 archived
      expect(result.completionRates).toHaveLength(4);
      expect(result.completionRates.every((r) => r.totalDays === 7)).toBe(true);
    });

    it("counts distinct days with approved completions in 7-day window", () => {
      insertCompletion(db, 1, "2026-03-29");
      insertCompletion(db, 1, "2026-03-28");
      insertCompletion(db, 1, "2026-03-27");
      // Outside the 7-day window (before 2026-03-23)
      insertCompletion(db, 1, "2026-03-22");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      const morning = result.completionRates.find((r) => r.routineId === 1);
      expect(morning?.daysCompleted).toBe(3);
    });

    it("only counts approved completions", () => {
      insertCompletion(db, 1, "2026-03-29", "approved");
      insertCompletion(db, 1, "2026-03-28", "pending");
      insertCompletion(db, 1, "2026-03-27", "rejected");
      insertCompletion(db, 1, "2026-03-26", "canceled");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      const morning = result.completionRates.find((r) => r.routineId === 1);
      expect(morning?.daysCompleted).toBe(1);
    });

    it("excludes archived routines", () => {
      const result = service.getRoutineHealth(LOCAL_TODAY);
      const ids = result.completionRates.map((r) => r.routineId);
      // Routine 4 is archived in seed data
      expect(ids).not.toContain(4);
    });

    it("returns zero for routines with no completions", () => {
      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.completionRates.every((r) => r.daysCompleted === 0)).toBe(
        true,
      );
    });
  });

  describe("timeSlotBreakdown", () => {
    it("groups completions by time slot", () => {
      insertCompletion(db, 1, "2026-03-29");
      insertCompletion(db, 1, "2026-03-28");
      insertCompletion(db, 2, "2026-03-29");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      const morning = result.timeSlotBreakdown.find(
        (s) => s.timeSlot === "morning",
      );
      const afternoon = result.timeSlotBreakdown.find(
        (s) => s.timeSlot === "afternoon",
      );
      expect(morning?.completedCount).toBe(2);
      expect(afternoon?.completedCount).toBe(1);
    });

    it("includes routine count per slot", () => {
      const result = service.getRoutineHealth(LOCAL_TODAY);
      const morning = result.timeSlotBreakdown.find(
        (s) => s.timeSlot === "morning",
      );
      const afternoon = result.timeSlotBreakdown.find(
        (s) => s.timeSlot === "afternoon",
      );
      const anytime = result.timeSlotBreakdown.find(
        (s) => s.timeSlot === "anytime",
      );

      // Seed: routine 1 = morning, routine 2 = afternoon, routine 3 = anytime, routine 5 = bedtime
      expect(morning?.routineCount).toBe(1);
      expect(afternoon?.routineCount).toBe(1);
      expect(anytime?.routineCount).toBe(1);
    });

    it("only includes slots that have routines or completions", () => {
      // Remove all routines, add one back
      db.prepare("DELETE FROM checklist_items").run();
      db.prepare("DELETE FROM routines").run();
      db.prepare(
        `INSERT INTO routines (id, name, time_slot, completion_rule, points, requires_approval, randomize_items, active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(10, "Only Morning", "morning", "once_per_day", 5, 0, 0, 1, 1);

      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.timeSlotBreakdown).toHaveLength(1);
      expect(result.timeSlotBreakdown[0].timeSlot).toBe("morning");
    });
  });

  describe("streakDays", () => {
    it("counts consecutive days with approved completions", () => {
      insertCompletion(db, 1, "2026-03-29");
      insertCompletion(db, 1, "2026-03-28");
      insertCompletion(db, 1, "2026-03-27");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.streakDays).toBe(3);
    });

    it("breaks streak on gap day", () => {
      insertCompletion(db, 1, "2026-03-29");
      insertCompletion(db, 1, "2026-03-28");
      // Gap on 2026-03-27
      insertCompletion(db, 1, "2026-03-26");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.streakDays).toBe(2);
    });

    it("returns zero with no completions", () => {
      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.streakDays).toBe(0);
    });

    it("reports streak from most recent completion even if not today", () => {
      insertCompletion(db, 1, "2026-03-27");
      insertCompletion(db, 1, "2026-03-26");
      insertCompletion(db, 1, "2026-03-25");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.streakDays).toBe(3);
    });

    it("counts different routines on same day as one streak day", () => {
      insertCompletion(db, 1, "2026-03-29");
      insertCompletion(db, 2, "2026-03-29");
      insertCompletion(db, 1, "2026-03-28");

      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.streakDays).toBe(2);
    });
  });

  describe("empty database", () => {
    it("returns sensible defaults when no routines exist", () => {
      db.prepare("DELETE FROM checklist_items").run();
      db.prepare("DELETE FROM routines").run();

      const result = service.getRoutineHealth(LOCAL_TODAY);
      expect(result.completionRates).toHaveLength(0);
      expect(result.timeSlotBreakdown).toHaveLength(0);
      expect(result.streakDays).toBe(0);
    });
  });
});
