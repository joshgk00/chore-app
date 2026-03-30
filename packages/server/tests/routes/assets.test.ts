import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { createTestDb, seedTestData, createTestConfig } from "../db-helpers.js";
import { createApp } from "../../src/app.js";
import { createTestImageFixtures, type TestImageFixtures } from "../helpers/fixture-images.js";

let fixtures: TestImageFixtures;

beforeAll(async () => {
  fixtures = await createTestImageFixtures();
});

afterAll(() => {
  fixtures.cleanup();
});

function createTestApp() {
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chore-app-assets-routes-"));
  const db = createTestDb();
  const config = createTestConfig({ dataDir: tmpDataDir });
  const app = createApp(db, config);
  return { db, app, tmpDataDir };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const res = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return res.headers["set-cookie"] as string[];
}

describe("assets routes", () => {
  let db: ReturnType<typeof createTestDb>;
  let app: ReturnType<typeof createApp>;
  let tmpDataDir: string;
  let cookies: string[];

  beforeEach(async () => {
    const testApp = createTestApp();
    db = testApp.db;
    app = testApp.app;
    tmpDataDir = testApp.tmpDataDir;
    await seedTestData(db);
    cookies = await loginAdmin(app);
  });

  afterEach(() => {
    db.close();
    try {
      fs.rmSync(tmpDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("POST /api/admin/assets/upload", () => {
    it("returns 201 and asset metadata for a valid JPEG", async () => {
      const res = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename: "photo.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.source).toBe("upload");
      expect(res.body.data.status).toBe("ready");
      expect(res.body.data.storedFilename).toMatch(/\.webp$/u);
      expect(res.body.data.originalFilename).toBe("photo.jpg");
      expect(res.body.data.url).toBeDefined();
    });

    it("returns 401 without admin session", async () => {
      // Auth is checked before multer — no need to attach a file
      const res = await request(app)
        .post("/api/admin/assets/upload")
        .send();

      expect(res.status).toBe(401);
    });

    it("returns 422 for an oversized file (> 5MB)", async () => {
      const res = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.oversizedJpgPath, {
          filename: "huge.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(422);
    });

    it("returns 422 for a non-image file (MIME validated by content)", async () => {
      const res = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.notAnImagePath, {
          filename: "not-an-image.jpg",
          contentType: "image/jpeg",
        });

      expect(res.status).toBe(422);
    });

    it("returns 422 when no file is provided", async () => {
      const res = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
    });
  });

  describe("GET /api/admin/assets", () => {
    async function uploadAsset(filename = "photo.jpg") {
      return request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename,
          contentType: "image/jpeg",
        });
    }

    it("returns asset list with metadata", async () => {
      await uploadAsset("a.jpg");
      await uploadAsset("b.jpg");

      const res = await request(app)
        .get("/api/admin/assets")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].url).toBeDefined();
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app).get("/api/admin/assets");
      expect(res.status).toBe(401);
    });

    it("filters by source=upload", async () => {
      await uploadAsset();
      // Insert a fake generated asset
      db.prepare(
        `INSERT INTO assets (source, reusable, status, stored_filename, mime_type)
         VALUES ('ai_generated', 0, 'ready', 'gen.webp', 'image/webp')`
      ).run();

      const res = await request(app)
        .get("/api/admin/assets?source=upload")
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.every((a: { source: string }) => a.source === "upload")).toBe(true);
    });
  });

  describe("POST /api/admin/assets/:id/archive", () => {
    it("archives the asset and returns success", async () => {
      const uploadRes = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename: "to-archive.jpg",
          contentType: "image/jpeg",
        });

      const assetId = uploadRes.body.data.id;

      const archiveRes = await request(app)
        .post(`/api/admin/assets/${assetId}/archive`)
        .set("Cookie", cookies);

      expect(archiveRes.status).toBe(200);
      expect(archiveRes.body.data.success).toBe(true);

      const listRes = await request(app)
        .get("/api/admin/assets?status=archived")
        .set("Cookie", cookies);
      expect(listRes.body.data.some((a: { id: number }) => a.id === assetId)).toBe(true);
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app).post("/api/admin/assets/1/archive");
      expect(res.status).toBe(401);
    });

    it("returns 404 for nonexistent asset", async () => {
      const res = await request(app)
        .post("/api/admin/assets/9999/archive")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/admin/assets/:id/usage", () => {
    it("returns empty usage for an unused asset", async () => {
      const uploadRes = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename: "unused.jpg",
          contentType: "image/jpeg",
        });

      const assetId = uploadRes.body.data.id;

      const res = await request(app)
        .get(`/api/admin/assets/${assetId}/usage`)
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.assetId).toBe(assetId);
      expect(res.body.data.usedBy).toHaveLength(0);
    });

    it("returns usage when asset is linked to a routine", async () => {
      const uploadRes = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename: "routine-linked.jpg",
          contentType: "image/jpeg",
        });

      const assetId = uploadRes.body.data.id;

      db.prepare(
        `INSERT INTO routines (name, time_slot, completion_rule, image_asset_id) VALUES (?, ?, ?, ?)`
      ).run("Test Routine", "morning", "once_per_day", assetId);

      const res = await request(app)
        .get(`/api/admin/assets/${assetId}/usage`)
        .set("Cookie", cookies);

      expect(res.status).toBe(200);
      expect(res.body.data.usedBy).toHaveLength(1);
      expect(res.body.data.usedBy[0].entityType).toBe("routine");
      expect(res.body.data.usedBy[0].entityName).toBe("Test Routine");
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app).get("/api/admin/assets/1/usage");
      expect(res.status).toBe(401);
    });

    it("returns 404 for nonexistent asset", async () => {
      const res = await request(app)
        .get("/api/admin/assets/9999/usage")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
    });

    it("returns 422 for invalid asset ID", async () => {
      const res = await request(app)
        .get("/api/admin/assets/abc/usage")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
    });
  });

  describe("DELETE /api/admin/assets/:id", () => {
    it("deletes the asset and returns success", async () => {
      const uploadRes = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename: "to-delete.jpg",
          contentType: "image/jpeg",
        });

      const assetId = uploadRes.body.data.id;

      const deleteRes = await request(app)
        .delete(`/api/admin/assets/${assetId}`)
        .set("Cookie", cookies);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.data.success).toBe(true);

      const listRes = await request(app)
        .get("/api/admin/assets")
        .set("Cookie", cookies);
      expect(listRes.body.data.find((a: { id: number }) => a.id === assetId)).toBeUndefined();
    });

    it("clears image from linked entities on delete", async () => {
      const uploadRes = await request(app)
        .post("/api/admin/assets/upload")
        .set("Cookie", cookies)
        .attach("file", fixtures.validJpgPath, {
          filename: "linked-delete.jpg",
          contentType: "image/jpeg",
        });

      const assetId = uploadRes.body.data.id;

      db.prepare(
        `INSERT INTO routines (name, time_slot, completion_rule, image_asset_id) VALUES (?, ?, ?, ?)`
      ).run("Linked Routine", "morning", "once_per_day", assetId);

      await request(app)
        .delete(`/api/admin/assets/${assetId}`)
        .set("Cookie", cookies);

      const routine = db.prepare(`SELECT image_asset_id FROM routines WHERE name = ?`).get("Linked Routine") as { image_asset_id: number | null };
      expect(routine.image_asset_id).toBeNull();
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app).delete("/api/admin/assets/1");
      expect(res.status).toBe(401);
    });

    it("returns 404 for nonexistent asset", async () => {
      const res = await request(app)
        .delete("/api/admin/assets/9999")
        .set("Cookie", cookies);

      expect(res.status).toBe(404);
    });

    it("returns 422 for invalid asset ID", async () => {
      const res = await request(app)
        .delete("/api/admin/assets/abc")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
    });
  });

  describe("POST /api/admin/assets/generate", () => {
    it("returns 503 when image generation is not configured", async () => {
      const res = await request(app)
        .post("/api/admin/assets/generate")
        .set("Cookie", cookies)
        .send({ prompt: "a cute cat" });

      expect(res.status).toBe(503);
    });

    it("returns 422 when prompt is missing", async () => {
      const res = await request(app)
        .post("/api/admin/assets/generate")
        .set("Cookie", cookies)
        .send({});

      expect(res.status).toBe(422);
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app)
        .post("/api/admin/assets/generate")
        .send({ prompt: "a cute cat" });

      expect(res.status).toBe(401);
    });

    it("returns 422 for an unknown model", async () => {
      const testDb = createTestDb();
      await seedTestData(testDb);
      const appWithKey = createApp(
        testDb,
        createTestConfig({ dataDir: tmpDataDir, imageGenApiKey: "sk-test" }),
      );
      const adminCookies = await loginAdmin(appWithKey);

      const res = await request(appWithKey)
        .post("/api/admin/assets/generate")
        .set("Cookie", adminCookies)
        .send({ prompt: "a cute cat", model: "expensive-model-9000" });

      expect(res.status).toBe(422);
      expect(res.body.error.message).toContain("Unknown model");
      testDb.close();
    });

    it("accepts a valid model without model validation error", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: [{ b64_json: "" }] }), { status: 200 }),
      );

      const testDb = createTestDb();
      await seedTestData(testDb);
      const appWithKey = createApp(
        testDb,
        createTestConfig({ dataDir: tmpDataDir, imageGenApiKey: "sk-test" }),
      );
      const adminCookies = await loginAdmin(appWithKey);

      const res = await request(appWithKey)
        .post("/api/admin/assets/generate")
        .set("Cookie", adminCookies)
        .send({ prompt: "a cute cat", model: "flux-2-flex" });

      expect(res.status).not.toBe(422);
      fetchSpy.mockRestore();
      testDb.close();
    });
  });
});
