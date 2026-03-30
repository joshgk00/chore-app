import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  const app = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app)
    .post("/api/auth/verify")
    .send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin system-health routes", () => {
  describe("GET /api/admin/system-health", () => {
    it("returns 200 with correct shape", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/system-health")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("databaseSizeBytes");
      expect(res.body.data).toHaveProperty("activityEventCount");
      expect(res.body.data).toHaveProperty("lastBackupAt");
      expect(res.body.data).toHaveProperty("pushSubscriptions");
      expect(typeof res.body.data.databaseSizeBytes).toBe("number");
      expect(typeof res.body.data.activityEventCount).toBe("number");
      expect(res.body.data.pushSubscriptions).toHaveProperty("active");
      expect(res.body.data.pushSubscriptions).toHaveProperty("expired");
      expect(res.body.data.pushSubscriptions).toHaveProperty("failed");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/system-health");

      expect(res.status).toBe(401);
      db.close();
    });

    it("reflects activity event count", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      db.prepare(
        "INSERT INTO activity_events (event_type, summary) VALUES (?, ?)",
      ).run("test_event", "Test");

      const res = await request(app)
        .get("/api/admin/system-health")
        .set("Cookie", cookies);

      expect(res.body.data.activityEventCount).toBeGreaterThanOrEqual(1);
      db.close();
    });

    it("reflects push subscription counts", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      db.prepare(
        "INSERT INTO push_subscriptions (role, endpoint, p256dh, auth, status) VALUES (?, ?, ?, ?, ?)",
      ).run("admin", "https://push.example.com/1", "p256dh", "auth", "active");
      db.prepare(
        "INSERT INTO push_subscriptions (role, endpoint, p256dh, auth, status) VALUES (?, ?, ?, ?, ?)",
      ).run("admin", "https://push.example.com/2", "p256dh", "auth", "failed");

      const res = await request(app)
        .get("/api/admin/system-health")
        .set("Cookie", cookies);

      expect(res.body.data.pushSubscriptions.active).toBe(1);
      expect(res.body.data.pushSubscriptions.failed).toBe(1);
      db.close();
    });
  });
});
