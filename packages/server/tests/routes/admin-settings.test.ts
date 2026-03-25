import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  const { app } = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>["app"]) {
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin settings routes", () => {
  describe("GET /api/admin/settings", () => {
    it("returns public settings without admin_pin_hash", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/settings")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty("timezone");
      expect(res.body.data).toHaveProperty("morning_start");
      expect(res.body.data).not.toHaveProperty("admin_pin_hash");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/settings");

      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("PUT /api/admin/settings", () => {
    it("updates timezone", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings")
        .set("Cookie", cookies)
        .send({ timezone: "America/Chicago" });

      expect(res.status).toBe(200);
      expect(res.body.data.timezone).toBe("America/Chicago");
      db.close();
    });

    it("updates time slots", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings")
        .set("Cookie", cookies)
        .send({ morning_start: "06:00", morning_end: "11:30" });

      expect(res.status).toBe(200);
      expect(res.body.data.morning_start).toBe("06:00");
      expect(res.body.data.morning_end).toBe("11:30");
      db.close();
    });

    it("validates time format", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings")
        .set("Cookie", cookies)
        .send({ morning_start: "6am" });

      expect(res.status).toBe(422);
      db.close();
    });

    it("rejects out-of-range time values", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings")
        .set("Cookie", cookies)
        .send({ morning_start: "99:99" });

      expect(res.status).toBe(422);
      db.close();
    });

    it("rejects unknown keys", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings")
        .set("Cookie", cookies)
        .send({ unknown_key: "value" });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .put("/api/admin/settings")
        .send({ timezone: "America/Chicago" });

      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("PUT /api/admin/settings/pin", () => {
    it("changes PIN and invalidates sessions", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings/pin")
        .set("Cookie", cookies)
        .send({ currentPin: "123456", newPin: "654321" });

      expect(res.status).toBe(200);
      expect(res.body.data.pinChanged).toBe(true);

      const sessionRes = await request(app)
        .get("/api/admin/settings")
        .set("Cookie", cookies);

      expect(sessionRes.status).toBe(401);

      const loginRes = await request(app)
        .post("/api/auth/verify")
        .send({ pin: "654321" });

      expect(loginRes.status).toBe(200);
      db.close();
    });

    it("returns 401 for wrong current PIN", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings/pin")
        .set("Cookie", cookies)
        .send({ currentPin: "000000", newPin: "654321" });

      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 422 for short PIN", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings/pin")
        .set("Cookie", cookies)
        .send({ currentPin: "123456", newPin: "123" });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for non-digit PIN", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings/pin")
        .set("Cookie", cookies)
        .send({ currentPin: "123456", newPin: "abcdef" });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain("digits");
      db.close();
    });

    it("trims whitespace from PIN before validation", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/settings/pin")
        .set("Cookie", cookies)
        .send({ currentPin: "123456", newPin: "  654321  " });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post("/api/auth/verify")
        .send({ pin: "654321" });

      expect(loginRes.status).toBe(200);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .put("/api/admin/settings/pin")
        .send({ currentPin: "123456", newPin: "654321" });

      expect(res.status).toBe(401);
      db.close();
    });
  });
});
