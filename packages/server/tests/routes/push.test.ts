import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { createApp } from "../../src/app.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "push-route-test-"));
});

function getTestConfig() {
  return createTestConfig({ dataDir: tmpDir });
}

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  const app = createApp(db, getTestConfig());
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("push routes", () => {
  describe("GET /api/push/vapid-public-key", () => {
    it("returns the VAPID public key without auth", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/push/vapid-public-key");

      expect(res.status).toBe(200);
      expect(typeof res.body.data.key).toBe("string");
      expect(res.body.data.key.length).toBeGreaterThan(0);
      db.close();
    });
  });

  describe("POST /api/push/subscribe", () => {
    it("subscribes child without auth", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "child",
          endpoint: "https://push.example.com/sub1",
          p256dh: "test-p256dh",
          auth: "test-auth",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.subscribed).toBe(true);

      const row = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/sub1") as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.role).toBe("child");
      db.close();
    });

    it("subscribes admin with valid session", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/push/subscribe")
        .set("Cookie", cookies)
        .send({
          role: "admin",
          endpoint: "https://push.example.com/admin1",
          p256dh: "admin-p256dh",
          auth: "admin-auth",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.subscribed).toBe(true);

      const row = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/admin1") as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.role).toBe("admin");
      db.close();
    });

    it("rejects admin subscription without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "admin",
          endpoint: "https://push.example.com/admin1",
          p256dh: "admin-p256dh",
          auth: "admin-auth",
        });

      expect(res.status).toBe(401);
      db.close();
    });

    it("deduplicates subscriptions by endpoint", async () => {
      const { db, app } = await createTestApp();

      await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "child",
          endpoint: "https://push.example.com/same",
          p256dh: "old-key",
          auth: "old-auth",
        });

      await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "child",
          endpoint: "https://push.example.com/same",
          p256dh: "new-key",
          auth: "new-auth",
        });

      const rows = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .all("https://push.example.com/same");
      expect(rows).toHaveLength(1);
      expect((rows[0] as Record<string, unknown>).p256dh).toBe("new-key");
      db.close();
    });

    it("rejects missing role", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          endpoint: "https://push.example.com/sub1",
          p256dh: "test-p256dh",
          auth: "test-auth",
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("rejects invalid role", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "superuser",
          endpoint: "https://push.example.com/sub1",
          p256dh: "test-p256dh",
          auth: "test-auth",
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("rejects missing endpoint", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "child",
          p256dh: "test-p256dh",
          auth: "test-auth",
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("rejects missing p256dh", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "child",
          endpoint: "https://push.example.com/sub1",
          auth: "test-auth",
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("rejects missing auth", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/push/subscribe")
        .send({
          role: "child",
          endpoint: "https://push.example.com/sub1",
          p256dh: "test-p256dh",
        });

      expect(res.status).toBe(422);
      db.close();
    });
  });
});
