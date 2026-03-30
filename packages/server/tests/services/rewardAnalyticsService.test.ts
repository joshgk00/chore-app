import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, seedTestData } from "../db-helpers.js";
import { seedRewardData, seedPointsLedger } from "../helpers/seed-rewards.js";
import { createRewardAnalyticsService } from "../../src/services/rewardAnalyticsService.js";
import type { RewardAnalyticsService } from "../../src/services/rewardAnalyticsService.js";

function insertRewardRequest(
  db: Database.Database,
  rewardId: number,
  costSnapshot: number,
  status = "approved",
): void {
  db.prepare(
    `INSERT INTO reward_requests
       (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    rewardId,
    `Reward ${rewardId}`,
    costSnapshot,
    "2026-03-29",
    status,
    `key-${rewardId}-${status}-${Math.random()}`,
  );
}

describe("rewardAnalyticsService", () => {
  let db: Database.Database;
  let service: RewardAnalyticsService;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestData(db);
    seedRewardData(db);
    service = createRewardAnalyticsService(db);
  });

  describe("pendingCount and pendingTotalCost", () => {
    it("counts pending requests and sums their cost", () => {
      insertRewardRequest(db, 1, 20, "pending");
      insertRewardRequest(db, 2, 50, "pending");
      insertRewardRequest(db, 1, 20, "approved");

      const result = service.getRewardDemand();
      expect(result.pendingCount).toBe(2);
      expect(result.pendingTotalCost).toBe(70);
    });

    it("returns zero when no pending requests exist", () => {
      insertRewardRequest(db, 1, 20, "approved");

      const result = service.getRewardDemand();
      expect(result.pendingCount).toBe(0);
      expect(result.pendingTotalCost).toBe(0);
    });
  });

  describe("rankings", () => {
    it("ranks rewards by request count descending", () => {
      insertRewardRequest(db, 1, 20, "approved");
      insertRewardRequest(db, 1, 20, "pending");
      insertRewardRequest(db, 1, 20, "approved");
      insertRewardRequest(db, 2, 50, "approved");

      const result = service.getRewardDemand();
      expect(result.rankings).toHaveLength(2);
      expect(result.rankings[0].rewardId).toBe(1);
      expect(result.rankings[0].requestCount).toBe(3);
      expect(result.rankings[1].rewardId).toBe(2);
      expect(result.rankings[1].requestCount).toBe(1);
    });

    it("counts approved requests and total cost correctly", () => {
      insertRewardRequest(db, 1, 20, "approved");
      insertRewardRequest(db, 1, 20, "pending");
      insertRewardRequest(db, 1, 20, "rejected");

      const result = service.getRewardDemand();
      const ranking = result.rankings.find((r) => r.rewardId === 1);
      expect(ranking?.approvedCount).toBe(1);
      expect(ranking?.totalCost).toBe(20);
    });

    it("returns empty rankings when no requests exist", () => {
      const result = service.getRewardDemand();
      expect(result.rankings).toHaveLength(0);
    });
  });

  describe("neverRequested", () => {
    it("lists active rewards with zero requests", () => {
      insertRewardRequest(db, 1, 20, "approved");

      const result = service.getRewardDemand();
      expect(result.neverRequested).toHaveLength(1);
      expect(result.neverRequested[0].rewardId).toBe(2);
      expect(result.neverRequested[0].rewardName).toBe("Movie Night Pick");
    });

    it("excludes archived rewards", () => {
      const result = service.getRewardDemand();
      const ids = result.neverRequested.map((r) => r.rewardId);
      expect(ids).not.toContain(3);
    });

    it("returns empty when all active rewards have been requested", () => {
      insertRewardRequest(db, 1, 20, "approved");
      insertRewardRequest(db, 2, 50, "approved");

      const result = service.getRewardDemand();
      expect(result.neverRequested).toHaveLength(0);
    });
  });

  describe("pointsEarned and pointsRedeemed", () => {
    it("sums positive ledger entries as earned", () => {
      seedPointsLedger(db, 100);
      seedPointsLedger(db, 50);

      const result = service.getRewardDemand();
      expect(result.pointsEarned).toBe(150);
    });

    it("sums approved reward request costs as redeemed", () => {
      insertRewardRequest(db, 1, 20, "approved");
      insertRewardRequest(db, 2, 50, "approved");
      insertRewardRequest(db, 1, 20, "pending");

      const result = service.getRewardDemand();
      expect(result.pointsRedeemed).toBe(70);
    });

    it("returns zero when no data exists", () => {
      const result = service.getRewardDemand();
      expect(result.pointsEarned).toBe(0);
      expect(result.pointsRedeemed).toBe(0);
    });
  });

  describe("empty database", () => {
    it("returns sensible defaults when no rewards exist", () => {
      db.prepare("DELETE FROM rewards").run();

      const result = service.getRewardDemand();
      expect(result.pendingCount).toBe(0);
      expect(result.pendingTotalCost).toBe(0);
      expect(result.rankings).toHaveLength(0);
      expect(result.neverRequested).toHaveLength(0);
      expect(result.pointsEarned).toBe(0);
      expect(result.pointsRedeemed).toBe(0);
    });
  });
});
