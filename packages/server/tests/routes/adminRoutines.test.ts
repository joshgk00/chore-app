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
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin routines routes", () => {
  describe("GET /api/admin/routines", () => {
    it("returns all routines including archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routines")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(5);
      const ids = res.body.data.map((r: { id: number }) => r.id);
      expect(ids).toContain(4);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/routines");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("GET /api/admin/routines/:id", () => {
    it("returns routine with all items including archived", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routines/1")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(1);
      expect(res.body.data.name).toBe("Morning Routine");
      expect(res.body.data.items).toHaveLength(3);
      db.close();
    });

    it("returns archived routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routines/4")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(4);
      expect(res.body.data.archivedAt).toBeDefined();
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/routines/1");
      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 404 for nonexistent routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/routines/999")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });
  });

  describe("POST /api/admin/routines", () => {
    it("creates routine with items and returns 201", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines")
        .set("Cookie", cookies)
        .send({
          name: "New Routine",
          timeSlot: "morning",
          completionRule: "once_per_day",
          points: 10,
          requiresApproval: false,
          randomizeItems: true,
          sortOrder: 6,
          items: [
            { label: "Step 1", sortOrder: 1 },
            { label: "Step 2", sortOrder: 2 },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe("New Routine");
      expect(res.body.data.points).toBe(10);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items[0].label).toBe("Step 1");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/admin/routines")
        .send({ name: "Test", timeSlot: "morning", completionRule: "once_per_day", points: 5, requiresApproval: false, randomizeItems: false, sortOrder: 1, items: [{ label: "A", sortOrder: 1 }] });

      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 422 for missing name", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines")
        .set("Cookie", cookies)
        .send({
          name: "",
          timeSlot: "morning",
          completionRule: "once_per_day",
          points: 5,
          requiresApproval: false,
          randomizeItems: false,
          sortOrder: 1,
          items: [{ label: "A", sortOrder: 1 }],
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for once_per_slot with anytime time slot", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines")
        .set("Cookie", cookies)
        .send({
          name: "Bad Combo",
          timeSlot: "anytime",
          completionRule: "once_per_slot",
          points: 5,
          requiresApproval: false,
          randomizeItems: false,
          sortOrder: 1,
          items: [{ label: "A", sortOrder: 1 }],
        });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for no items", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines")
        .set("Cookie", cookies)
        .send({
          name: "No Items",
          timeSlot: "morning",
          completionRule: "once_per_day",
          points: 5,
          requiresApproval: false,
          randomizeItems: false,
          sortOrder: 1,
          items: [],
        });

      expect(res.status).toBe(422);
      db.close();
    });
  });

  describe("PUT /api/admin/routines/:id", () => {
    it("updates routine fields", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/routines/1")
        .set("Cookie", cookies)
        .send({ name: "Updated Morning", points: 15 });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Updated Morning");
      expect(res.body.data.points).toBe(15);
      db.close();
    });

    it("updates routine with item management", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/routines/1")
        .set("Cookie", cookies)
        .send({
          items: [
            { id: 1, label: "Brush teeth (updated)", sortOrder: 1 },
            { label: "New item", sortOrder: 4 },
          ],
        });

      expect(res.status).toBe(200);
      const labels = res.body.data.items.map((i: { label: string }) => i.label);
      expect(labels).toContain("Brush teeth (updated)");
      expect(labels).toContain("New item");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .put("/api/admin/routines/1")
        .send({ name: "Test" });

      expect(res.status).toBe(401);
      db.close();
    });

    it("returns 404 for nonexistent routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .put("/api/admin/routines/999")
        .set("Cookie", cookies)
        .send({ name: "Ghost" });

      expect(res.status).toBe(404);
      db.close();
    });
  });

  describe("POST /api/admin/routines/:id/archive", () => {
    it("archives an active routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines/1/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/api/admin/routines/1")
        .set("Cookie", cookies);
      expect(getRes.body.data.archivedAt).toBeDefined();
      db.close();
    });

    it("returns 404 for already archived routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines/4/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).post("/api/admin/routines/1/archive");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("POST /api/admin/routines/:id/unarchive", () => {
    it("restores an archived routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines/4/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);

      const getRes = await request(app)
        .get("/api/admin/routines/4")
        .set("Cookie", cookies);
      expect(getRes.body.data.archivedAt).toBeUndefined();
      db.close();
    });

    it("returns 404 for non-archived routine", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/routines/1/unarchive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).post("/api/admin/routines/4/unarchive");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("visibility", () => {
    it("archived routine visible in admin list but hidden from child endpoint", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const adminRes = await request(app)
        .get("/api/admin/routines")
        .set("Cookie", cookies);
      const adminIds = adminRes.body.data.map((r: { id: number }) => r.id);
      expect(adminIds).toContain(4);

      const childRes = await request(app).get("/api/routines");
      const childIds = childRes.body.data.map((r: { id: number }) => r.id);
      expect(childIds).not.toContain(4);
      db.close();
    });
  });
});
