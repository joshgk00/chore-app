import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { seedChoreData } from "../helpers/seed-chores.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  seedChoreData(db);
  const app = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app)
    .post("/api/auth/verify")
    .send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin chore-analytics routes", () => {
  describe("GET /api/admin/chore-analytics", () => {
    it("returns 200 with correct shape", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("engagementRates");
      expect(res.body.data).toHaveProperty("inactiveChores");
      expect(res.body.data).toHaveProperty("submissionTrends");
      expect(res.body.data).toHaveProperty("windowDays");
      expect(Array.isArray(res.body.data.engagementRates)).toBe(true);
      expect(typeof res.body.data.windowDays).toBe("number");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/chore-analytics");

      expect(res.status).toBe(401);
      db.close();
    });

    it("includes only active chores in engagement rates", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      // Seed data has 3 active chores (ids 1, 2, 4) — id 3 is archived
      expect(res.body.data.engagementRates).toHaveLength(3);
      const choreIds = res.body.data.engagementRates.map(
        (r: { choreId: number }) => r.choreId,
      );
      expect(choreIds).not.toContain(3);
      db.close();
    });

    it("marks chores with no submissions as inactive", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      expect(res.body.data.inactiveChores).toHaveLength(3);
      db.close();
    });

    it("counts submissions within the window", async () => {
      const { db, app } = await createTestApp();

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
      db.prepare(
        `INSERT INTO chore_logs (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
         points_snapshot, requires_approval_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, "Clean Kitchen", 1, "Quick Clean", 3, 0, today, "approved", "key-1");
      db.prepare(
        `INSERT INTO chore_logs (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
         points_snapshot, requires_approval_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, "Clean Kitchen", 2, "Deep Clean", 5, 0, today, "approved", "key-2");

      const cookies = await loginAdmin(app);
      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      const kitchen = res.body.data.engagementRates.find(
        (r: { choreId: number }) => r.choreId === 1,
      );
      expect(kitchen.submissionCount).toBe(2);
      expect(kitchen.approvedCount).toBe(2);
      expect(kitchen.totalPoints).toBe(8);

      expect(res.body.data.inactiveChores).toHaveLength(2);
      expect(res.body.data.submissionTrends).toHaveLength(1);
      expect(res.body.data.submissionTrends[0].date).toBe(today);
      expect(res.body.data.submissionTrends[0].submissions).toBe(2);
      db.close();
    });

    it("distinguishes approved from pending submissions", async () => {
      const { db, app } = await createTestApp();

      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
      db.prepare(
        `INSERT INTO chore_logs (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
         points_snapshot, requires_approval_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, "Clean Kitchen", 1, "Quick Clean", 3, 0, today, "approved", "key-mix-1");
      db.prepare(
        `INSERT INTO chore_logs (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
         points_snapshot, requires_approval_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, "Clean Kitchen", 2, "Deep Clean", 5, 1, today, "pending", "key-mix-2");
      db.prepare(
        `INSERT INTO chore_logs (chore_id, chore_name_snapshot, tier_id, tier_name_snapshot,
         points_snapshot, requires_approval_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(1, "Clean Kitchen", 1, "Quick Clean", 3, 0, today, "rejected", "key-mix-3");

      const cookies = await loginAdmin(app);
      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      const kitchen = res.body.data.engagementRates.find(
        (r: { choreId: number }) => r.choreId === 1,
      );
      expect(kitchen.submissionCount).toBe(3);
      expect(kitchen.approvedCount).toBe(1);
      expect(kitchen.totalPoints).toBe(3);
      db.close();
    });

    it("uses default timezone when setting is missing", async () => {
      const db = createTestDb();
      await seedTestData(db);
      seedChoreData(db);
      db.prepare("DELETE FROM settings WHERE key = 'timezone'").run();
      const app = createApp(db, testConfig);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("engagementRates");
      db.close();
    });

    it("returns 500 when service throws", async () => {
      const db = createTestDb();
      await seedTestData(db);
      seedChoreData(db);
      const app = createApp(db, testConfig);
      const cookies = await loginAdmin(app);

      db.prepare("DROP TABLE chore_logs").run();

      const res = await request(app)
        .get("/api/admin/chore-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(500);
      db.close();
    });
  });
});
