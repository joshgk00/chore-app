import { describe, it, expect } from "vitest";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { seedRoutineData } from "../helpers/seed-routines.js";
import { seedChoreData } from "../helpers/seed-chores.js";
import { seedRewardData, seedPointsLedger } from "../helpers/seed-rewards.js";
import { seedPendingSubmissions } from "../helpers/seed-approvals.js";
import { createApp } from "../../src/app.js";

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  seedChoreData(db);
  seedRewardData(db);
  seedPendingSubmissions(db);
  seedPointsLedger(db, 100);
  const app = createApp(db, testConfig);
  return { db, app };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const loginRes = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return loginRes.headers["set-cookie"] as string[];
}

describe("admin approval routes", () => {
  describe("GET /api/admin/approvals", () => {
    it("returns grouped pending items", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/approvals")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.routineCompletions).toBeDefined();
      expect(res.body.data.choreLogs).toBeDefined();
      expect(res.body.data.rewardRequests).toBeDefined();
      expect(res.body.data.routineCompletions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.choreLogs.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.rewardRequests.length).toBeGreaterThanOrEqual(1);
      db.close();
    });

    it("only includes pending items", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .get("/api/admin/approvals")
        .set("Cookie", cookies);

      const allStatuses = [
        ...res.body.data.routineCompletions.map((c: { status: string }) => c.status),
        ...res.body.data.choreLogs.map((c: { status: string }) => c.status),
        ...res.body.data.rewardRequests.map((r: { status: string }) => r.status),
      ];
      expect(allStatuses.every((s: string) => s === "pending")).toBe(true);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app).get("/api/admin/approvals");
      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("POST /api/admin/approvals/:type/:id/approve", () => {
    it("approves a pending routine completion", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
      expect(res.body.data.reviewedAt).toBeTruthy();
      db.close();
    });

    it("approves with review note", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({ reviewNote: "Great work!" });

      expect(res.status).toBe(200);
      expect(res.body.data.reviewNote).toBe("Great work!");
      db.close();
    });

    it("approves a pending chore log", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/chore-log/1/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
      db.close();
    });

    it("approves a pending reward request", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/reward-request/1/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("approved");
      db.close();
    });

    it("returns 409 when approving already-approved item", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/2/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(409);
      db.close();
    });

    it("returns 409 on double-approve", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({});

      const res2 = await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res2.status).toBe(409);
      db.close();
    });

    it("returns 404 for nonexistent id", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/999/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(404);
      db.close();
    });

    it("returns 422 for invalid approval type", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/invalid-type/1/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for non-numeric id", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/abc/approve")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for review note exceeding 500 chars", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({ reviewNote: "a".repeat(501) });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .send({});

      expect(res.status).toBe(401);
      db.close();
    });

    it("creates positive ledger entry on routine approval", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({});

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'routine_completions' AND reference_id = 1`,
      ).get() as { amount: number } | undefined;
      expect(ledger).toBeTruthy();
      expect(ledger!.amount).toBe(3);
      db.close();
    });

    it("creates negative ledger entry on reward approval", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      await request(app)
        .post("/api/admin/approvals/reward-request/1/approve")
        .set("Cookie", cookies)
        .send({});

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'reward_requests' AND reference_id = 1`,
      ).get() as { amount: number } | undefined;
      expect(ledger).toBeTruthy();
      expect(ledger!.amount).toBe(-20);
      db.close();
    });
  });

  describe("POST /api/admin/approvals/:type/:id/reject", () => {
    it("rejects a pending routine completion", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .set("Cookie", cookies)
        .send({ reviewNote: "Not complete" });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("rejected");
      expect(res.body.data.reviewNote).toBe("Not complete");
      db.close();
    });

    it("rejects a pending chore log", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/chore-log/1/reject")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe("rejected");
      db.close();
    });

    it("rejects a pending reward request and releases reservation", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const beforeRes = await request(app).get("/api/points/summary");
      const reservedBefore = beforeRes.body.data.reserved;

      await request(app)
        .post("/api/admin/approvals/reward-request/1/reject")
        .set("Cookie", cookies)
        .send({});

      const afterRes = await request(app).get("/api/points/summary");
      expect(afterRes.body.data.reserved).toBeLessThan(reservedBefore);
      db.close();
    });

    it("creates no ledger entry on rejection", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .set("Cookie", cookies)
        .send({});

      const ledger = db.prepare(
        `SELECT * FROM points_ledger WHERE reference_table = 'routine_completions' AND reference_id = 1`,
      ).get();
      expect(ledger).toBeUndefined();
      db.close();
    });

    it("returns 409 on double-reject", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .set("Cookie", cookies)
        .send({});

      const res2 = await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .set("Cookie", cookies)
        .send({});

      expect(res2.status).toBe(409);
      db.close();
    });

    it("returns 422 for invalid type", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/bad-type/1/reject")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for review note exceeding 500 chars", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .set("Cookie", cookies)
        .send({ reviewNote: "a".repeat(501) });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 422 for non-string review note", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .set("Cookie", cookies)
        .send({ reviewNote: 123 });

      expect(res.status).toBe(422);
      db.close();
    });

    it("returns 401 without session", async () => {
      const { db, app } = await createTestApp();

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/reject")
        .send({});

      expect(res.status).toBe(401);
      db.close();
    });
  });

  describe("reviewNote validation (approve)", () => {
    it("returns 422 for non-string review note", async () => {
      const { db, app } = await createTestApp();
      const cookies = await loginAdmin(app);

      const res = await request(app)
        .post("/api/admin/approvals/routine-completion/1/approve")
        .set("Cookie", cookies)
        .send({ reviewNote: true });

      expect(res.status).toBe(422);
      db.close();
    });
  });
});
