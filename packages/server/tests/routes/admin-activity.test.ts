import { describe, it, expect } from "vitest";
import request from "supertest";
import type Database from "better-sqlite3";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  const { app } = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

function seedActivityEvents(db: Database.Database) {
  const insert = db.prepare(
    `INSERT INTO activity_events (event_type, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?)`,
  );
  insert.run("routine_submitted", "routine", 1, "Completed morning routine", "2026-03-20 08:00:00");
  insert.run("chore_submitted", "chore", 1, "Did the dishes", "2026-03-20 15:00:00");
  insert.run("reward_requested", "reward", 1, "Requested screen time", "2026-03-21 10:00:00");
  insert.run("routine_approved", "routine", 1, "Morning routine approved", "2026-03-21 12:00:00");
  insert.run("manual_adjustment", "points_ledger", 1, "Bonus points", "2026-03-22 09:00:00");
}

describe("admin activity routes", () => {
  describe("GET /api/admin/activity-log", () => {
    it("returns events and total count", async () => {
      const { db, app } = await createTestApp();
      seedActivityEvents(db);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(5);
      expect(res.body.data.total).toBe(5);
      expect(res.body.data.page).toBe(0);
      expect(res.body.data.limit).toBe(50);
      db.close();
    });

    it("respects page and limit params", async () => {
      const { db, app } = await createTestApp();
      seedActivityEvents(db);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?limit=2&page=0")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(2);
      expect(res.body.data.total).toBe(5);

      const res2 = await request(app)
        .get("/api/admin/activity-log?limit=2&page=1")
        .set("Cookie", cookies);

      expect(res2.status).toBe(200);
      expect(res2.body.data.events).toHaveLength(2);
      expect(res2.body.data.total).toBe(5);

      const res3 = await request(app)
        .get("/api/admin/activity-log?limit=2&page=2")
        .set("Cookie", cookies);

      expect(res3.status).toBe(200);
      expect(res3.body.data.events).toHaveLength(1);
      db.close();
    });

    it("filters by event_type", async () => {
      const { db, app } = await createTestApp();
      seedActivityEvents(db);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?event_type=routine_submitted")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.total).toBe(1);
      expect(res.body.data.events[0].eventType).toBe("routine_submitted");
      db.close();
    });

    it("filters by start_date and end_date", async () => {
      const { db, app } = await createTestApp();
      seedActivityEvents(db);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?start_date=2026-03-21&end_date=2026-03-21")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(2);
      expect(res.body.data.total).toBe(2);
      db.close();
    });

    it("combines multiple filters", async () => {
      const { db, app } = await createTestApp();
      seedActivityEvents(db);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?event_type=routine_approved&start_date=2026-03-21")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toHaveLength(1);
      expect(res.body.data.events[0].eventType).toBe("routine_approved");
      db.close();
    });

    it("returns 422 for invalid event_type", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?event_type=invalid_type")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for invalid start_date format", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?start_date=not-a-date")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for invalid end_date format", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?end_date=03-22-2026")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for negative page", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?page=-1")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for limit out of range", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log?limit=201")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);

      const res2 = await request(app)
        .get("/api/admin/activity-log?limit=0")
        .set("Cookie", cookies);

      expect(res2.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/activity-log");

      expect(res.status).toBe(401);
      db.close();
    });

    it("returns empty events array with total 0 when no data", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/activity-log")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.events).toEqual([]);
      expect(res.body.data.total).toBe(0);
      db.close();
    });
  });
});
