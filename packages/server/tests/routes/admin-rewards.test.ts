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
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin rewards routes", () => {
  describe("GET /api/admin/rewards", () => {
    it("returns all rewards including archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/rewards")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(3);
      const ids = res.body.data.map((r: { id: number }) => r.id);
      expect(ids).toContain(3);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/rewards");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("GET /api/admin/rewards/:id", () => {
    it("returns single reward by id", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/rewards/1")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Extra Screen Time");
      expect(res.body.data.pointsCost).toBe(20);
      db.close();
    });

    it("returns archived reward with archivedAt", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/rewards/3")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.archivedAt).toBeTruthy();
      db.close();
    });

    it("returns 404 for nonexistent reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/rewards/999")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 422 for non-numeric id", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/rewards/abc")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/rewards/1");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("POST /api/admin/rewards", () => {
    it("creates reward and returns 201", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards")
        .set("Cookie", cookies)
        .send({
          name: "New Reward",
          pointsCost: 30,
          sortOrder: 5,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("New Reward");
      expect(res.body.data.pointsCost).toBe(30);
      expect(res.body.data.sortOrder).toBe(5);
      expect(res.body.data.archivedAt).toBeUndefined();
      db.close();
    });

    it("returns 422 for missing name", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards")
        .set("Cookie", cookies)
        .send({
          name: "",
          pointsCost: 10,
          sortOrder: 1,
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for non-integer pointsCost", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards")
        .set("Cookie", cookies)
        .send({
          name: "Test",
          pointsCost: 10.5,
          sortOrder: 1,
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for negative pointsCost", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards")
        .set("Cookie", cookies)
        .send({
          name: "Test",
          pointsCost: -1,
          sortOrder: 1,
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for sortOrder out of range", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards")
        .set("Cookie", cookies)
        .send({
          name: "Test",
          pointsCost: 10,
          sortOrder: 10000,
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/admin/rewards")
        .send({ name: "Test", pointsCost: 10, sortOrder: 1 });

      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("PUT /api/admin/rewards/:id", () => {
    it("updates reward fields", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/rewards/1")
        .set("Cookie", cookies)
        .send({ name: "Updated Screen Time", pointsCost: 25 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Screen Time");
      expect(res.body.data.pointsCost).toBe(25);
      db.close();
    });

    it("returns 404 for nonexistent reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/rewards/999")
        .set("Cookie", cookies)
        .send({ name: "Ghost" });

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 409 for archived reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/rewards/3")
        .set("Cookie", cookies)
        .send({ name: "Updated" });

      expect(res.status).toBe(409);
      db.close();
    });

    it("returns 422 for name exceeding 200 characters", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/rewards/1")
        .set("Cookie", cookies)
        .send({ name: "a".repeat(201) });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .put("/api/admin/rewards/1")
        .send({ name: "Test" });

      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("POST /api/admin/rewards/:id/archive", () => {
    it("archives an active reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards/1/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/api/admin/rewards")
        .set("Cookie", cookies);
      const reward = getRes.body.data.find((r: { id: number }) => r.id === 1);
      expect(reward.archivedAt).toBeDefined();
      db.close();
    });

    it("returns 409 if already archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards/3/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(409);
      db.close();
    });

    it("returns 404 for nonexistent reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards/999/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).post("/api/admin/rewards/1/archive");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("POST /api/admin/rewards/:id/unarchive", () => {
    it("unarchives a reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards/3/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/api/admin/rewards")
        .set("Cookie", cookies);
      const reward = getRes.body.data.find((r: { id: number }) => r.id === 3);
      expect(reward.archivedAt).toBeUndefined();
      db.close();
    });

    it("returns 409 if not archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards/1/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(409);
      db.close();
    });

    it("returns 404 for nonexistent reward", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/rewards/999/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).post("/api/admin/rewards/3/unarchive");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("visibility", () => {
    it("archived reward visible in admin list but hidden from child endpoint", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const adminRes = await request(app)
        .get("/api/admin/rewards")
        .set("Cookie", cookies);
      const adminIds = adminRes.body.data.map((r: { id: number }) => r.id);
      expect(adminIds).toContain(3);

      const childRes = await request(app).get("/api/rewards");
      const childIds = childRes.body.data.map((r: { id: number }) => r.id);
      expect(childIds).not.toContain(3);
      db.close();
    });
  });
});
