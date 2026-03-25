import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { BackupService } from "../services/backupService.js";
import { ValidationError } from "../lib/errors.js";

export function createAdminBackupRoutes(
  backupService: BackupService,
  dataDir: string,
) {
  const router = Router();

  const tempDir = path.join(dataDir, "temp");
  fs.mkdirSync(tempDir, { recursive: true });

  const upload = multer({
    dest: tempDir,
    limits: { fileSize: 100 * 1024 * 1024 },
  });

  router.post("/export", async (_req, res, next) => {
    try {
      const zipPath = await backupService.createExport();
      const filename = path.basename(zipPath);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

      const stream = fs.createReadStream(zipPath);
      stream.on("error", (err) => {
        if (!res.headersSent) {
          next(err);
        }
      });
      stream.pipe(res);
      stream.on("end", () => {
        try {
          fs.unlinkSync(zipPath);
        } catch {
          // Best-effort cleanup
        }
      });
    } catch (err) {
      next(err);
    }
  });

  router.post("/restore", (req, res, next) => {
    upload.single("backup")(req, res, async (multerErr) => {
      try {
        if (multerErr) {
          if ("code" in multerErr && multerErr.code === "LIMIT_FILE_SIZE") {
            throw new ValidationError("Backup file exceeds 100MB limit");
          }
          throw multerErr;
        }
        if (!req.file) {
          throw new ValidationError("No backup file provided");
        }
        await backupService.restoreBackup(req.file.path);

        // The original db handle is closed after restore — all other services are
        // now holding a dead reference. Wait for the response to flush, then exit
        // so the process manager (Docker, systemd) restarts with the restored database.
        res.on("finish", () => setTimeout(() => process.exit(0), 200));
        res.json({ data: { restored: true } });
      } catch (err) {
        next(err);
      }
    });
  });

  return router;
}
