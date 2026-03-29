import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { seedRoutineData } from "../helpers/seed-routines.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  const app = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app)
    .post("/api/auth/verify")
    .send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin routine-analytics routes", () => {
  describe("GET /api/admin/routine-analytics", () => {
    it("returns 200 with correct shape", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routine-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("completionRates");
      expect(res.body.data).toHaveProperty("timeSlotBreakdown");
      expect(res.body.data).toHaveProperty("streakDays");
      expect(Array.isArray(res.body.data.completionRates)).toBe(true);
      expect(typeof res.body.data.streakDays).toBe("number");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/routine-analytics");

      expect(res.status).toBe(401);
      db.close();
    });

    it("includes active routines in completion rates", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routine-analytics")
        .set("Cookie", cookies);

      // Seed data has 4 active routines (ids 1, 2, 3, 5)
      expect(res.body.data.completionRates).toHaveLength(4);
      expect(
        res.body.data.completionRates.every(
          (r: { totalDays: number }) => r.totalDays === 7,
        ),
      ).toBe(true);
      db.close();
    });

    it("uses default timezone when setting is missing", async () => {
      const db = createTestDb();
      await seedTestData(db);
      seedRoutineData(db);
      db.prepare("DELETE FROM settings WHERE key = 'timezone'").run();
      const app = createApp(db, testConfig);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routine-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("completionRates");
      db.close();
    });

    it("returns 500 when service throws", async () => {
      const db = createTestDb();
      await seedTestData(db);
      seedRoutineData(db);
      const app = createApp(db, testConfig);
      const cookies = await loginAdmin(app);

      db.prepare("DROP TABLE routine_completions").run();

      const res = await request(app)
        .get("/api/admin/routine-analytics")
        .set("Cookie", cookies);

      expect(res.status).toBe(500);
      db.close();
    });
  });
});
