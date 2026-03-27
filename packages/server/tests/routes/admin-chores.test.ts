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
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin chores routes", () => {
  describe("GET /api/admin/chores", () => {
    it("returns all chores including archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chores")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(4);
      const ids = res.body.data.map((c: { id: number }) => c.id);
      expect(ids).toContain(3);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/chores");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("GET /api/admin/chores/:id", () => {
    it("returns chore with all tiers including archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chores/4")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(4);
      expect(res.body.data.name).toBe("Laundry");
      expect(res.body.data.tiers).toHaveLength(2);
      db.close();
    });

    it("returns archived chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chores/3")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(3);
      expect(res.body.data.archivedAt).toBeDefined();
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/chores/1");
      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 404 for nonexistent chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/chores/999")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });
  });

  describe("POST /api/admin/chores", () => {
    it("creates chore with tiers and returns 201", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores")
        .set("Cookie", cookies)
        .send({
          name: "New Chore",
          requiresApproval: false,
          sortOrder: 5,
          tiers: [
            { name: "Easy", points: 3, sortOrder: 1 },
            { name: "Hard", points: 7, sortOrder: 2 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("New Chore");
      expect(res.body.data.requiresApproval).toBe(false);
      expect(res.body.data.tiers).toHaveLength(2);
      expect(res.body.data.tiers[0].name).toBe("Easy");
      expect(res.body.data.tiers[0].points).toBe(3);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/admin/chores")
        .send({ name: "Test", requiresApproval: false, sortOrder: 1, tiers: [{ name: "A", points: 1, sortOrder: 1 }] });

      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 422 for missing name", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores")
        .set("Cookie", cookies)
        .send({
          name: "",
          requiresApproval: false,
          sortOrder: 1,
          tiers: [{ name: "A", points: 1, sortOrder: 1 }],
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for no tiers", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores")
        .set("Cookie", cookies)
        .send({
          name: "No Tiers",
          requiresApproval: false,
          sortOrder: 1,
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for empty tiers array", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores")
        .set("Cookie", cookies)
        .send({
          name: "Empty Tiers",
          requiresApproval: false,
          sortOrder: 1,
          tiers: [],
        });

      expect(res.status).toBe(422);
      db.close();
    });
  });

  describe("PUT /api/admin/chores/:id", () => {
    it("updates chore fields", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/chores/1")
        .set("Cookie", cookies)
        .send({ name: "Updated Kitchen", requiresApproval: true });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Kitchen");
      expect(res.body.data.requiresApproval).toBe(true);
      db.close();
    });

    it("updates with tier management", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/chores/1")
        .set("Cookie", cookies)
        .send({
          tiers: [
            { id: 1, name: "Quick Clean (updated)", points: 4, sortOrder: 1 },
            { name: "New Tier", points: 8, sortOrder: 3 },
          ],
        });

      expect(res.status).toBe(200);
      const names = res.body.data.tiers.map((t: { name: string }) => t.name);
      expect(names).toContain("Quick Clean (updated)");
      expect(names).toContain("New Tier");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .put("/api/admin/chores/1")
        .send({ name: "Test" });

      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 404 for nonexistent chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/chores/999")
        .set("Cookie", cookies)
        .send({ name: "Ghost" });

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 409 for archived chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/chores/3")
        .set("Cookie", cookies)
        .send({ name: "Updated" });

      expect(res.status).toBe(409);
      db.close();
    });
  });

  describe("POST /api/admin/chores/:id/archive", () => {
    it("archives an active chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores/1/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/api/admin/chores/1")
        .set("Cookie", cookies);
      expect(getRes.body.data.archivedAt).toBeDefined();
      db.close();
    });

    it("returns 404 for already archived chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores/3/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).post("/api/admin/chores/1/archive");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("POST /api/admin/chores/:id/unarchive", () => {
    it("restores an archived chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores/3/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/api/admin/chores/3")
        .set("Cookie", cookies);
      expect(getRes.body.data.archivedAt).toBeUndefined();
      db.close();
    });

    it("returns 404 for non-archived chore", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/chores/1/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).post("/api/admin/chores/3/unarchive");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("visibility", () => {
    it("archived chore visible in admin list but hidden from child endpoint", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const adminRes = await request(app)
        .get("/api/admin/chores")
        .set("Cookie", cookies);
      const adminIds = adminRes.body.data.map((c: { id: number }) => c.id);
      expect(adminIds).toContain(3);

      const childRes = await request(app).get("/api/chores");
      const childIds = childRes.body.data.map((c: { id: number }) => c.id);
      expect(childIds).not.toContain(3);
      db.close();
    });
  });
});
