import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import archiver from "archiver";
import AdmZip from "adm-zip";
import type Database from "better-sqlite3";
import type { BackupManifest } from "@chore-app/shared";
import { openDatabase } from "../db/connection.js";
import { runMigrations } from "../db/migrate.js";
import { createActivityService, type ActivityService } from "./activityService.js";
import { AppError, ValidationError } from "../lib/errors.js";

const MAX_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500MB

export interface BackupService {
  createExport(): Promise<string>;
  restoreBackup(uploadedFilePath: string): Promise<void>;
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function deletePath(targetPath: string): void {
  try {
    if (fs.existsSync(targetPath)) {
      const stat = fs.statSync(targetPath);
      if (stat.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }
  } catch {
    // Best-effort cleanup
  }
}

function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function createBackupService(
  db: Database.Database,
  dataDir: string,
  config: { timezone: string },
  activityService: ActivityService,
): BackupService {
  const schemaVersionStmt = db.prepare(
    "SELECT version FROM _migrations ORDER BY id DESC LIMIT 1",
  );

  function getSchemaVersion(): string {
    const row = schemaVersionStmt.get() as { version: string } | undefined;
    return row?.version ?? "unknown";
  }

  function getAppVersion(): string {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  }

  async function createExport(): Promise<string> {
    const backupsDir = path.join(dataDir, "backups");
    fs.mkdirSync(backupsDir, { recursive: true });

    const timestamp = formatTimestamp(new Date());
    const zipPath = path.join(backupsDir, `backup-${timestamp}.zip`);
    const tempDbPath = path.join(backupsDir, `backup-${timestamp}.sqlite`);

    try {
      await db.backup(tempDbPath);

      const manifest: BackupManifest = {
        appVersion: getAppVersion(),
        schemaVersion: getSchemaVersion(),
        timezone: config.timezone,
        exportedAt: new Date().toISOString(),
      };

      const archive = archiver("zip", { zlib: { level: 6 } });
      const output = fs.createWriteStream(zipPath);

      const archiveFinished = new Promise<void>((resolve, reject) => {
        output.on("close", resolve);
        output.on("error", reject);
        archive.on("error", reject);
      });

      archive.pipe(output);

      archive.file(tempDbPath, { name: "db.sqlite" });
      archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

      const assetsDir = path.join(dataDir, "assets");
      if (fs.existsSync(assetsDir)) {
        archive.directory(assetsDir, "assets");
      }

      // VAPID keys included so restored instances can continue delivering push
      // notifications without requiring all clients to re-subscribe.
      const webpushPath = path.join(dataDir, "secrets", "webpush.json");
      if (fs.existsSync(webpushPath)) {
        archive.file(webpushPath, { name: "secrets/webpush.json" });
      }

      await archive.finalize();
      await archiveFinished;

      try {
        activityService.recordActivity({
          eventType: "backup_exported",
          summary: `Backup exported: backup-${timestamp}.zip`,
        });
      } catch {
        // Best-effort — export already succeeded
      }

      return zipPath;
    } finally {
      deletePath(tempDbPath);
    }
  }

  async function restoreBackup(uploadedFilePath: string): Promise<void> {
    let zip: AdmZip;
    try {
      zip = new AdmZip(uploadedFilePath);
    } catch {
      deletePath(uploadedFilePath);
      throw new ValidationError("Uploaded file is not a valid ZIP archive");
    }

    const manifestEntry = zip.getEntry("manifest.json");
    if (!manifestEntry) {
      deletePath(uploadedFilePath);
      throw new ValidationError("Backup archive is missing manifest.json");
    }

    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(manifestEntry.getData().toString("utf-8")) as BackupManifest;
    } catch {
      deletePath(uploadedFilePath);
      throw new ValidationError("Backup manifest.json is invalid");
    }

    if (!manifest.schemaVersion || !manifest.exportedAt) {
      deletePath(uploadedFilePath);
      throw new ValidationError("Backup manifest is missing required fields");
    }

    const dbEntry = zip.getEntry("db.sqlite");
    if (!dbEntry) {
      deletePath(uploadedFilePath);
      throw new ValidationError("Backup archive is missing db.sqlite");
    }

    // Guard against ZIP bombs — check total uncompressed size before extracting
    const totalUncompressed = zip.getEntries().reduce((sum, e) => sum + e.header.size, 0);
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      deletePath(uploadedFilePath);
      throw new ValidationError(
        `Backup uncompressed size (${Math.round(totalUncompressed / 1024 / 1024)}MB) exceeds 500MB limit`,
      );
    }

    const currentSchema = getSchemaVersion();
    // Migration versions are zero-padded numerics (001, 002, etc.) — compare as strings
    // which works correctly for zero-padded values.
    if (manifest.schemaVersion > currentSchema && currentSchema !== "unknown") {
      deletePath(uploadedFilePath);
      throw new ValidationError(
        `Backup schema version (${manifest.schemaVersion}) is newer than current (${currentSchema}). ` +
          "Update the app before restoring this backup.",
      );
    }

    const timestamp = formatTimestamp(new Date());
    const preRestoreDir = path.join(dataDir, "backups", `pre-restore-${timestamp}`);
    fs.mkdirSync(preRestoreDir, { recursive: true });

    const dbPath = path.join(dataDir, "db.sqlite");
    const assetsDir = path.join(dataDir, "assets");
    const secretsDir = path.join(dataDir, "secrets");

    try {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, path.join(preRestoreDir, "db.sqlite"));
      }
      if (fs.existsSync(assetsDir)) {
        copyDirRecursive(assetsDir, path.join(preRestoreDir, "assets"));
      }
      if (fs.existsSync(path.join(secretsDir, "webpush.json"))) {
        fs.mkdirSync(path.join(preRestoreDir, "secrets"), { recursive: true });
        fs.copyFileSync(
          path.join(secretsDir, "webpush.json"),
          path.join(preRestoreDir, "secrets", "webpush.json"),
        );
      }
    } catch {
      throw new AppError(500, "BACKUP_FAILED", "Failed to create safety backup before restore");
    }

    db.close();

    try {
      fs.writeFileSync(dbPath, dbEntry.getData());

      const zipAssetsEntries = zip.getEntries().filter(
        (e) => e.entryName.startsWith("assets/") && !e.isDirectory,
      );
      if (zipAssetsEntries.length > 0) {
        if (fs.existsSync(assetsDir)) {
          fs.rmSync(assetsDir, { recursive: true, force: true });
        }
        fs.mkdirSync(assetsDir, { recursive: true });
        const resolvedDataDir = path.resolve(dataDir);
        for (const entry of zipAssetsEntries) {
          const destPath = path.resolve(path.join(dataDir, entry.entryName));
          if (!destPath.startsWith(resolvedDataDir + path.sep)) {
            throw new ValidationError(`Illegal path in archive: ${entry.entryName}`);
          }
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath, entry.getData());
        }
      }

      const webpushEntry = zip.getEntry("secrets/webpush.json");
      if (webpushEntry) {
        fs.mkdirSync(secretsDir, { recursive: true });
        fs.writeFileSync(path.join(secretsDir, "webpush.json"), webpushEntry.getData());
      }

      const restoredDb = openDatabase(dataDir);
      try {
        runMigrations(restoredDb);
        // restoredDb is ephemeral — no benefit to caching prepared statements
        restoredDb.prepare("DELETE FROM admin_sessions").run();

        const restoredActivity = createActivityService(restoredDb);
        restoredActivity.recordActivity({
          eventType: "backup_restored",
          summary: `Backup restored from ${manifest.exportedAt} (schema ${manifest.schemaVersion})`,
        });
      } finally {
        restoredDb.close();
      }
    } catch (err) {
      // Attempt to restore the safety backup on failure
      try {
        const safetyDbPath = path.join(preRestoreDir, "db.sqlite");
        if (fs.existsSync(safetyDbPath)) {
          fs.copyFileSync(safetyDbPath, dbPath);
        }
        const safetyAssetsDir = path.join(preRestoreDir, "assets");
        if (fs.existsSync(safetyAssetsDir)) {
          if (fs.existsSync(assetsDir)) {
            fs.rmSync(assetsDir, { recursive: true, force: true });
          }
          copyDirRecursive(safetyAssetsDir, assetsDir);
        }
        const safetyWebpush = path.join(preRestoreDir, "secrets", "webpush.json");
        if (fs.existsSync(safetyWebpush)) {
          fs.mkdirSync(secretsDir, { recursive: true });
          fs.copyFileSync(safetyWebpush, path.join(secretsDir, "webpush.json"));
        }
      } catch {
        // Safety restore itself failed — original data is in pre-restore dir
      }

      // DB handle is closed and all services are stale — exit so the process
      // manager restarts with the safety-restored files
      if (err instanceof AppError) {
        setTimeout(() => process.exit(1), 500);
        throw err;
      }
      setTimeout(() => process.exit(1), 500);
      throw new AppError(500, "RESTORE_FAILED", "Backup restore failed");
    } finally {
      deletePath(uploadedFilePath);
    }
  }

  return { createExport, restoreBackup };
}
