import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import request from "supertest";
import { seedTestData, createTestConfig } from "../db-helpers.js";
import { openDatabase } from "../../src/db/connection.js";
import { runMigrations } from "../../src/db/migrate.js";
import { createApp } from "../../src/app.js";

function createTestApp() {
  const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chore-app-backup-routes-"));
  const db = openDatabase(tmpDataDir);
  runMigrations(db);
  const config = createTestConfig({ dataDir: tmpDataDir });
  const app = createApp(db, config);
  return { db, app, tmpDataDir };
}

async function loginAdmin(app: ReturnType<typeof createApp>) {
  const res = await request(app).post("/api/auth/verify").send({ pin: "123456" });
  return res.headers["set-cookie"] as string[];
}

describe("admin backup routes", () => {
  let db: ReturnType<typeof openDatabase>;
  let app: ReturnType<typeof createApp>;
  let tmpDataDir: string;
  let cookies: string[];

  beforeEach(async () => {
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const testApp = createTestApp();
    db = testApp.db;
    app = testApp.app;
    tmpDataDir = testApp.tmpDataDir;
    await seedTestData(db);
    cookies = await loginAdmin(app);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    try {
      db.close();
    } catch {
      // DB may already be closed after restore
    }
    try {
      fs.rmSync(tmpDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("POST /api/admin/export", () => {
    it("returns a ZIP file with correct headers", async () => {
      const res = await request(app)
        .post("/api/admin/export")
        .set("Cookie", cookies)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toBe("application/zip");
      expect(res.headers["content-disposition"]).toMatch(/^attachment; filename="backup-.*\.zip"$/);
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app).post("/api/admin/export");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/admin/restore", () => {
    it("restores a valid backup ZIP and returns success", async () => {
      const exportRes = await request(app)
        .post("/api/admin/export")
        .set("Cookie", cookies)
        .buffer(true)
        .parse((res, callback) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => callback(null, Buffer.concat(chunks)));
        });

      expect(exportRes.status).toBe(200);
      const zipBuffer = exportRes.body as Buffer;

      const restoreRes = await request(app)
        .post("/api/admin/restore")
        .set("Cookie", cookies)
        .attach("backup", zipBuffer, { filename: "backup.zip", contentType: "application/zip" });

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body).toEqual({ data: { restored: true } });
    });

    it("returns 401 without admin session", async () => {
      const res = await request(app).post("/api/admin/restore");
      expect(res.status).toBe(401);
    });

    it("returns 422 with an invalid file (not a ZIP)", async () => {
      const res = await request(app)
        .post("/api/admin/restore")
        .set("Cookie", cookies)
        .attach("backup", Buffer.from("this is not a zip file"), {
          filename: "bad.zip",
          contentType: "application/zip",
        });

      expect(res.status).toBe(422);
    });

    it("returns 422 when no file is provided", async () => {
      const res = await request(app)
        .post("/api/admin/restore")
        .set("Cookie", cookies);

      expect(res.status).toBe(422);
    });
  });
});
