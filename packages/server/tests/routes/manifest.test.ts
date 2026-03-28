import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createTestDb, createTestConfig } from "../db-helpers.js";
import { createApp } from "../../src/app.js";
import type Database from "better-sqlite3";

const MANIFEST_FIXTURE = {
  name: "Chores",
  short_name: "Chores",
  display: "standalone",
  start_url: "/",
  background_color: "#ffffff",
  theme_color: "#f59e0b",
  icons: [
    { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
  ],
};

let db: Database.Database;
let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "manifest-test-"));
  fs.writeFileSync(
    path.join(tmpDir, "manifest.json"),
    JSON.stringify(MANIFEST_FIXTURE),
  );
  fs.writeFileSync(path.join(tmpDir, "index.html"), "<html></html>");
  db = createTestDb();
});

afterAll(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("GET /manifest.json", () => {
  it("returns the manifest with default start_url when no query param", async () => {
    const app = createApp(db, createTestConfig({ clientDistDir: tmpDir }));

    const res = await request(app).get("/manifest.json");
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Chores");
    expect(res.body.start_url).toBe("/");
  });

  it("overrides start_url when a valid value is provided", async () => {
    const app = createApp(db, createTestConfig({ clientDistDir: tmpDir }));

    const res = await request(app).get("/manifest.json?start_url=/admin");
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe("/admin");
    expect(res.body.name).toBe("Chores");
  });

  it("accepts /today as a valid start_url", async () => {
    const app = createApp(db, createTestConfig({ clientDistDir: tmpDir }));

    const res = await request(app).get("/manifest.json?start_url=/today");
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe("/today");
  });

  it("ignores invalid start_url values and falls back to default", async () => {
    const app = createApp(db, createTestConfig({ clientDistDir: tmpDir }));

    const res = await request(app).get("/manifest.json?start_url=/evil");
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe("/");
  });

  it("ignores start_url with external URLs", async () => {
    const app = createApp(db, createTestConfig({ clientDistDir: tmpDir }));

    const res = await request(app).get(
      "/manifest.json?start_url=https://evil.com",
    );
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe("/");
  });

  it("preserves all other manifest fields", async () => {
    const app = createApp(db, createTestConfig({ clientDistDir: tmpDir }));

    const res = await request(app).get("/manifest.json?start_url=/admin");
    expect(res.body.display).toBe("standalone");
    expect(res.body.theme_color).toBe("#f59e0b");
    expect(res.body.icons).toHaveLength(1);
  });
});
