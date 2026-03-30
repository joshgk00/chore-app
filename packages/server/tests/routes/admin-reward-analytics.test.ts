import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { seedRewardData } from "../helpers/seed-rewards.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  seedRewardData(db);
  const app = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app)
    .post("/api/auth/verify")
    .send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin reward-analytics routes", () => {
  describe("GET /api/admin/reward-analytics", () => {
    it("returns 200 with correct shape", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/reward-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("pendingCount");
      expect(res.body.data).toHaveProperty("pendingTotalCost");
      expect(res.body.data).toHaveProperty("rankings");
      expect(res.body.data).toHaveProperty("neverRequested");
      expect(res.body.data).toHaveProperty("pointsEarned");
      expect(res.body.data).toHaveProperty("pointsRedeemed");
      expect(Array.isArray(res.body.data.rankings)).toBe(true);
      expect(typeof res.body.data.pendingCount).toBe("number");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/reward-analytics");

      expect(res.status).toBe(401);
      db.close();
    });

    it("includes active rewards in neverRequested when none have been requested", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/reward-analytics")
        .set("Cookie", cookies);

      expect(res.body.data.neverRequested).toHaveLength(2);
      const ids = res.body.data.neverRequested.map(
        (r: { rewardId: number }) => r.rewardId,
      );
      expect(ids).not.toContain(3);
      db.close();
    });

    it("reflects pending requests in counts", async () => {
      const { db, app } = await createTestApp();

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(1, "Extra Screen Time", 20, "2026-03-29", "pending", "key-route-1");
      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(2, "Movie Night Pick", 50, "2026-03-29", "pending", "key-route-2");

      const cookies = await loginAdmin(app);
      const res = await request(app)
        .get("/api/admin/reward-analytics")
        .set("Cookie", cookies);

      expect(res.body.data.pendingCount).toBe(2);
      expect(res.body.data.pendingTotalCost).toBe(70);
      expect(res.body.data.rankings).toHaveLength(2);
      expect(res.body.data.neverRequested).toHaveLength(0);
      db.close();
    });

    it("returns 500 when service throws", async () => {
      const db = createTestDb();
      await seedTestData(db);
      seedRewardData(db);
      const app = createApp(db, testConfig);
      const cookies = await loginAdmin(app);

      db.prepare("DROP TABLE reward_requests").run();

      const res = await request(app)
        .get("/api/admin/reward-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(500);
      db.close();
    });
  });
});
