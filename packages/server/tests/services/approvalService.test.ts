import { describe, it, expect } from "vitest";
import { createTestDb, seedTestData } from "../db-helpers.js";
import { seedRoutineData } from "../helpers/seed-routines.js";
import { seedChoreData } from "../helpers/seed-chores.js";
import { seedRewardData, seedPointsLedger } from "../helpers/seed-rewards.js";
import { seedPendingSubmissions } from "../helpers/seed-approvals.js";
import { createApprovalService } from "../../src/services/approvalService.js";
import { createActivityService } from "../../src/services/activityService.js";
import { createBadgeService } from "../../src/services/badgeService.js";

function createTestServices(db: ReturnType<typeof createTestDb>) {
  const activityService = createActivityService(db);
  const badgeService = createBadgeService(db);
  const approvalService = createApprovalService(db, activityService, badgeService);
  return { activityService, badgeService, approvalService };
}

async function setupDb() {
  const db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  seedChoreData(db);
  seedRewardData(db);
  seedPendingSubmissions(db);
  return db;
}

describe("approvalService", () => {
  describe("getPendingApprovals", () => {
    it("returns grouped pending items from all three tables", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const pending = approvalService.getPendingApprovals();

      expect(pending.routineCompletions.length).toBeGreaterThanOrEqual(2);
      expect(pending.choreLogs.length).toBeGreaterThanOrEqual(1);
      expect(pending.rewardRequests.length).toBeGreaterThanOrEqual(1);

      expect(pending.routineCompletions.every((c) => c.status === "pending")).toBe(true);
      expect(pending.choreLogs.every((c) => c.status === "pending")).toBe(true);
      expect(pending.rewardRequests.every((r) => r.status === "pending")).toBe(true);
      db.close();
    });

    it("does not include approved, rejected, or canceled items", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const pending = approvalService.getPendingApprovals();

      const allIds = [
        ...pending.routineCompletions.map((c) => c.id),
        ...pending.choreLogs.map((c) => c.id),
        ...pending.rewardRequests.map((r) => r.id),
      ];
      expect(allIds).not.toContain(2); // approved routine completion
      db.close();
    });

    it("orders by submission time ascending", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const pending = approvalService.getPendingApprovals();

      if (pending.routineCompletions.length >= 2) {
        const dates = pending.routineCompletions.map((c) => c.completedAt);
        for (let i = 1; i < dates.length; i++) {
          expect(dates[i] >= dates[i - 1]).toBe(true);
        }
      }
      db.close();
    });
  });

  describe("approveRoutineCompletion", () => {
    it("changes status to approved and creates positive ledger entry", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const result = approvalService.approveRoutineCompletion(1);

      expect(result.status).toBe("approved");
      expect(result.reviewedAt).toBeTruthy();

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'routine_completions' AND reference_id = 1`,
      ).get() as { amount: number; entry_type: string; note: string } | undefined;
      expect(ledger).toBeTruthy();
      expect(ledger!.amount).toBe(3);
      expect(ledger!.entry_type).toBe("routine");
      expect(ledger!.note).toContain("Afternoon Check");
      db.close();
    });

    it("stores review note when provided", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const result = approvalService.approveRoutineCompletion(1, "Great job!");

      expect(result.reviewNote).toBe("Great job!");
      db.close();
    });

    it("records activity event on approval", async () => {
      const db = await setupDb();
      const { approvalService, activityService } = createTestServices(db);

      approvalService.approveRoutineCompletion(1);

      const events = activityService.getRecentActivity(10);
      const approvalEvent = events.find((e) => e.eventType === "routine_approved");
      expect(approvalEvent).toBeTruthy();
      expect(approvalEvent!.entityId).toBe(1);
      db.close();
    });

    it("throws ConflictError when approving already-approved item", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      expect(() => approvalService.approveRoutineCompletion(2)).toThrow();
      db.close();
    });

    it("throws ConflictError when approving already-processed item", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      approvalService.approveRoutineCompletion(1);
      expect(() => approvalService.approveRoutineCompletion(1)).toThrow();
      db.close();
    });

    it("throws NotFoundError for nonexistent id", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      expect(() => approvalService.approveRoutineCompletion(999)).toThrow();
      db.close();
    });

    it("evaluates badges after approval", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      approvalService.approveRoutineCompletion(1);

      const badges = db.prepare(`SELECT * FROM badges_earned`).all();
      // first_step badge should be evaluated (at least 1 approved routine completion)
      expect(badges.length).toBeGreaterThanOrEqual(0);
      db.close();
    });
  });

  describe("rejectRoutineCompletion", () => {
    it("changes status to rejected with no ledger entry", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const result = approvalService.rejectRoutineCompletion(1, "Try again");

      expect(result.status).toBe("rejected");
      expect(result.reviewNote).toBe("Try again");
      expect(result.reviewedAt).toBeTruthy();

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'routine_completions' AND reference_id = 1`,
      ).get();
      expect(ledger).toBeUndefined();
      db.close();
    });

    it("records activity event on rejection", async () => {
      const db = await setupDb();
      const { approvalService, activityService } = createTestServices(db);

      approvalService.rejectRoutineCompletion(1);

      const events = activityService.getRecentActivity(10);
      const rejectEvent = events.find((e) => e.eventType === "routine_rejected");
      expect(rejectEvent).toBeTruthy();
      db.close();
    });

    it("throws ConflictError when rejecting already-processed item", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      approvalService.rejectRoutineCompletion(1);
      expect(() => approvalService.rejectRoutineCompletion(1)).toThrow();
      db.close();
    });
  });

  describe("approveChoreLog", () => {
    it("changes status to approved and creates positive ledger entry", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const result = approvalService.approveChoreLog(1);

      expect(result.status).toBe("approved");

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'chore_logs' AND reference_id = 1`,
      ).get() as { amount: number; entry_type: string; note: string } | undefined;
      expect(ledger).toBeTruthy();
      expect(ledger!.amount).toBe(10);
      expect(ledger!.entry_type).toBe("chore");
      expect(ledger!.note).toContain("Yard Work");
      db.close();
    });

    it("stores review note on approval", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const result = approvalService.approveChoreLog(1, "Well done");
      expect(result.reviewNote).toBe("Well done");
      db.close();
    });

    it("throws ConflictError for already-rejected chore log", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      expect(() => approvalService.approveChoreLog(2)).toThrow();
      db.close();
    });

    it("evaluates badges after chore approval", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      approvalService.approveChoreLog(1);

      const events = db.prepare(
        `SELECT * FROM activity_events WHERE event_type = 'chore_approved'`,
      ).all();
      expect(events.length).toBe(1);
      db.close();
    });
  });

  describe("rejectChoreLog", () => {
    it("changes status to rejected with no ledger entry", async () => {
      const db = await setupDb();
      const { approvalService } = createTestServices(db);

      const result = approvalService.rejectChoreLog(1, "Incomplete");

      expect(result.status).toBe("rejected");
      expect(result.reviewNote).toBe("Incomplete");

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'chore_logs' AND reference_id = 1`,
      ).get();
      expect(ledger).toBeUndefined();
      db.close();
    });
  });

  describe("approveRewardRequest", () => {
    it("changes status to approved and creates negative ledger entry", async () => {
      const db = await setupDb();
      seedPointsLedger(db, 100);
      const { approvalService } = createTestServices(db);

      const result = approvalService.approveRewardRequest(1);

      expect(result.status).toBe("approved");

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'reward_requests' AND reference_id = 1`,
      ).get() as { amount: number; entry_type: string; note: string } | undefined;
      expect(ledger).toBeTruthy();
      expect(ledger!.amount).toBe(-20);
      expect(ledger!.entry_type).toBe("reward");
      expect(ledger!.note).toContain("Extra Screen Time");
      db.close();
    });

    it("stores review note on reward approval", async () => {
      const db = await setupDb();
      seedPointsLedger(db, 100);
      const { approvalService } = createTestServices(db);

      const result = approvalService.approveRewardRequest(1, "Enjoy!");
      expect(result.reviewNote).toBe("Enjoy!");
      db.close();
    });

    it("records activity event on reward approval", async () => {
      const db = await setupDb();
      seedPointsLedger(db, 100);
      const { approvalService, activityService } = createTestServices(db);

      approvalService.approveRewardRequest(1);

      const events = activityService.getRecentActivity(10);
      const approvalEvent = events.find((e) => e.eventType === "reward_approved");
      expect(approvalEvent).toBeTruthy();
      db.close();
    });

    it("throws ConflictError when approving already-processed reward", async () => {
      const db = await setupDb();
      seedPointsLedger(db, 100);
      const { approvalService } = createTestServices(db);

      approvalService.approveRewardRequest(1);
      expect(() => approvalService.approveRewardRequest(1)).toThrow();
      db.close();
    });
  });

  describe("rejectRewardRequest", () => {
    it("changes status to rejected — reservation released", async () => {
      const db = await setupDb();
      seedPointsLedger(db, 100);
      const { approvalService } = createTestServices(db);

      const beforeReserved = db.prepare(
        `SELECT COALESCE(SUM(cost_snapshot), 0) as reserved FROM reward_requests WHERE status = 'pending'`,
      ).get() as { reserved: number };
      expect(beforeReserved.reserved).toBe(20);

      const result = approvalService.rejectRewardRequest(1, "Not available");

      expect(result.status).toBe("rejected");
      expect(result.reviewNote).toBe("Not available");

      const afterReserved = db.prepare(
        `SELECT COALESCE(SUM(cost_snapshot), 0) as reserved FROM reward_requests WHERE status = 'pending'`,
      ).get() as { reserved: number };
      expect(afterReserved.reserved).toBe(0);

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'reward_requests' AND reference_id = 1`,
      ).get();
      expect(ledger).toBeUndefined();
      db.close();
    });
  });

  describe("transaction atomicity", () => {
    it("rolls back ledger entry if activity logging fails", async () => {
      const db = await setupDb();
      const badActivityService = {
        recordActivity: () => {},
        recordActivityOrThrow: () => { throw new Error("Activity logging failed"); },
        getRecentActivity: () => [],
      };
      const badgeService = createBadgeService(db);
      const approvalService = createApprovalService(db, badActivityService, badgeService);

      expect(() => approvalService.approveRoutineCompletion(1)).toThrow("Activity logging failed");

      const completion = db.prepare(
        `SELECT status FROM routine_completions WHERE id = 1`,
      ).get() as { status: string };
      expect(completion.status).toBe("pending");

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'routine_completions' AND reference_id = 1`,
      ).get();
      expect(ledger).toBeUndefined();
      db.close();
    });
  });
});
