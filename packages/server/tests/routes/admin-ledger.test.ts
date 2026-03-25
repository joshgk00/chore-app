import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { seedRewardData, seedPointsLedger } from "../helpers/seed-rewards.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  seedRewardData(db);
  seedPointsLedger(db, 100);
  const app = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin ledger routes", () => {
  describe("GET /api/admin/points/ledger", () => {
    it("returns entries and balance", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/points/ledger")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.entries).toBeDefined();
      expect(res.body.data.balance).toBeDefined();
      expect(res.body.data.entries.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.balance.total).toBe(100);
      expect(res.body.data.balance).toHaveProperty("reserved");
      expect(res.body.data.balance).toHaveProperty("available");
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/points/ledger");

      expect(res.status).toBe(401);
      db.close();
    });

    it("respects limit and offset query params", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      seedPointsLedger(db, 20);
      seedPointsLedger(db, 30);
      seedPointsLedger(db, 40);

      const res = await request(app)
        .get("/api/admin/points/ledger?limit=2&offset=0")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.entries).toHaveLength(2);

      const res2 = await request(app)
        .get("/api/admin/points/ledger?limit=2&offset=2")
        .set("Cookie", cookies);

      expect(res2.status).toBe(200);
      expect(res2.body.data.entries).toHaveLength(2);
      db.close();
    });

    it("filters by entry_type query param", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      // Seed a chore-type ledger entry alongside the existing manual entry
      db.prepare(
        `INSERT INTO points_ledger (entry_type, reference_table, reference_id, amount, note)
         VALUES ('chore', 'chore_logs', 1, 5, 'Chore points')`,
      ).run();

      const res = await request(app)
        .get("/api/admin/points/ledger?entry_type=manual")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      const allManual = res.body.data.entries.every(
        (e: { entryType: string }) => e.entryType === "manual",
      );
      expect(allManual).toBe(true);
      db.close();
    });

    it("returns 422 for invalid entry_type", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/points/ledger?entry_type=invalid")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns empty entries array with valid balance when no ledger data", async () => {
      const db = createTestDb();
      await seedTestData(db);
      seedRewardData(db);
      const app = createApp(db, testConfig);
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/points/ledger")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.entries).toEqual([]);
      expect(res.body.data.balance.total).toBe(0);
      expect(res.body.data.balance.available).toBe(0);
      db.close();
    });
  });

  describe("POST /api/admin/points/adjust", () => {
    it("creates positive adjustment", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: 25, note: "Bonus points" });

      expect(res.status).toBe(201);
      expect(res.body.data.entry.entryType).toBe("manual");
      expect(res.body.data.entry.amount).toBe(25);
      expect(res.body.data.entry.note).toBe("Bonus points");
      db.close();
    });

    it("creates negative adjustment", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: -10, note: "Point correction" });

      expect(res.status).toBe(201);
      expect(res.body.data.entry.amount).toBe(-10);
      db.close();
    });

    it("returns updated balance after adjustment", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: 50, note: "Extra credit" });

      expect(res.status).toBe(201);
      expect(res.body.data.balance.total).toBe(150);
      db.close();
    });

    it("returns 422 when note missing", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: 10 });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 when amount is 0", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: 0, note: "Zero adjustment" });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 when amount is not a number", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: "ten", note: "Not a number" });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 when note is not a string", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .set("Cookie", cookies)
        .send({ amount: 10, note: 123 });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/admin/points/adjust")
        .send({ amount: 10, note: "No auth" });

      expect(res.status).toBe(401);
      db.close();
    });
  });
});
