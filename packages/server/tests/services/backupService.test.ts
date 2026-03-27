import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import AdmZip from "adm-zip";
import { seedTestData } from "../db-helpers.js";
import { openDatabase } from "../../src/db/connection.js";
import { runMigrations } from "../../src/db/migrate.js";
import { createActivityService } from "../../src/services/activityService.js";
import { createBackupService, type BackupService } from "../../src/services/backupService.js";
import { ValidationError } from "../../src/lib/errors.js";

function createFileBasedTestDb(dataDir: string) {
  const db = openDatabase(dataDir);
  runMigrations(db);
  return db;
}

describe("backupService", () => {
  let db: ReturnType<typeof openDatabase>;
  let dataDir: string;
  let service: BackupService;

  beforeEach(async () => {
    dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chore-app-backup-svc-"));
    db = createFileBasedTestDb(dataDir);
    await seedTestData(db);
    const activityService = createActivityService(db);
    service = createBackupService(db, dataDir, { timezone: "America/New_York" }, activityService);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // DB may already be closed after restore
    }
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  describe("createExport", () => {
    it("produces a ZIP file that exists on disk", async () => {
      const zipPath = await service.createExport();
      expect(fs.existsSync(zipPath)).toBe(true);
      expect(zipPath).toMatch(/\.zip$/);
    });

    it("ZIP contains db.sqlite and manifest.json", async () => {
      const zipPath = await service.createExport();
      const zip = new AdmZip(zipPath);
      const entryNames = zip.getEntries().map((e) => e.entryName);
      expect(entryNames).toContain("db.sqlite");
      expect(entryNames).toContain("manifest.json");
    });

    it("manifest includes appVersion, schemaVersion, timezone, and exportedAt", async () => {
      const zipPath = await service.createExport();
      const zip = new AdmZip(zipPath);
      const manifestEntry = zip.getEntry("manifest.json");
      expect(manifestEntry).toBeDefined();

      const manifest = JSON.parse(manifestEntry!.getData().toString("utf-8"));
      expect(manifest).toHaveProperty("appVersion");
      expect(manifest).toHaveProperty("schemaVersion");
      expect(manifest).toHaveProperty("timezone", "America/New_York");
      expect(manifest).toHaveProperty("exportedAt");
      expect(new Date(manifest.exportedAt).getTime()).not.toBeNaN();
    });

    it("ZIP includes assets/ directory if assets exist", async () => {
      const assetsDir = path.join(dataDir, "assets");
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.writeFileSync(path.join(assetsDir, "test-image.webp"), "fake image data");

      const zipPath = await service.createExport();
      const zip = new AdmZip(zipPath);
      const entryNames = zip.getEntries().map((e) => e.entryName);
      expect(entryNames.some((name) => name.startsWith("assets/"))).toBe(true);
    });

    it("ZIP includes secrets/webpush.json if it exists", async () => {
      const secretsDir = path.join(dataDir, "secrets");
      fs.mkdirSync(secretsDir, { recursive: true });
      fs.writeFileSync(
        path.join(secretsDir, "webpush.json"),
        JSON.stringify({ publicKey: "test", privateKey: "test" }),
      );

      const zipPath = await service.createExport();
      const zip = new AdmZip(zipPath);
      const entryNames = zip.getEntries().map((e) => e.entryName);
      expect(entryNames).toContain("secrets/webpush.json");
    });
  });

  describe("restoreBackup", () => {
    it("replaces the database with the backup contents", async () => {
      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
        "pre_backup_marker",
        "exists",
      );

      const zipPath = await service.createExport();
      const zipBuffer = fs.readFileSync(zipPath);

      db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(
        "post_backup_marker",
        "should_vanish",
      );

      const restorePath = path.join(dataDir, "restore-upload.zip");
      fs.writeFileSync(restorePath, zipBuffer);

      await service.restoreBackup(restorePath);

      const restoredDb = openDatabase(dataDir);
      try {
        const preMarker = restoredDb
          .prepare("SELECT value FROM settings WHERE key = ?")
          .get("pre_backup_marker") as { value: string } | undefined;
        const postMarker = restoredDb
          .prepare("SELECT value FROM settings WHERE key = ?")
          .get("post_backup_marker") as { value: string } | undefined;
        expect(preMarker?.value).toBe("exists");
        expect(postMarker).toBeUndefined();
      } finally {
        restoredDb.close();
      }
    });

    it("creates a safety backup (pre-restore-* directory) after restore", async () => {
      const zipPath = await service.createExport();
      const zipBuffer = fs.readFileSync(zipPath);

      const restorePath = path.join(dataDir, "restore-upload.zip");
      fs.writeFileSync(restorePath, zipBuffer);

      await service.restoreBackup(restorePath);

      const backupsDir = path.join(dataDir, "backups");
      const entries = fs.readdirSync(backupsDir);
      const preRestoreDirs = entries.filter((e) => e.startsWith("pre-restore-"));
      expect(preRestoreDirs.length).toBeGreaterThanOrEqual(1);
    });

    it("throws ValidationError for an invalid ZIP", async () => {
      const badPath = path.join(dataDir, "bad-file.zip");
      fs.writeFileSync(badPath, "this is not a zip file");

      await expect(service.restoreBackup(badPath)).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for a ZIP missing manifest.json", async () => {
      const zip = new AdmZip();
      zip.addFile("db.sqlite", Buffer.from("fake db"));
      const zipPath = path.join(dataDir, "no-manifest.zip");
      zip.writeZip(zipPath);

      await expect(service.restoreBackup(zipPath)).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for a ZIP missing db.sqlite", async () => {
      const zip = new AdmZip();
      zip.addFile(
        "manifest.json",
        Buffer.from(
          JSON.stringify({
            schemaVersion: "001-initial-schema",
            exportedAt: new Date().toISOString(),
            appVersion: "1.0.0",
            timezone: "UTC",
          }),
        ),
      );
      const zipPath = path.join(dataDir, "no-db.zip");
      zip.writeZip(zipPath);

      await expect(service.restoreBackup(zipPath)).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for a ZIP with a newer schema version", async () => {
      const zip = new AdmZip();
      zip.addFile(
        "manifest.json",
        Buffer.from(
          JSON.stringify({
            schemaVersion: "999-future",
            exportedAt: new Date().toISOString(),
            appVersion: "1.0.0",
            timezone: "UTC",
          }),
        ),
      );
      zip.addFile("db.sqlite", Buffer.from("fake db"));
      const zipPath = path.join(dataDir, "future-schema.zip");
      zip.writeZip(zipPath);

      await expect(service.restoreBackup(zipPath)).rejects.toThrow(ValidationError);
    });
  });
});
