import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import type { AssetService } from "../services/assetService.js";
import { AppError, ValidationError } from "../lib/errors.js";
import { parseIdParam } from "../lib/parse-id-param.js";
import { IMAGE_MODELS } from "@chore-app/shared";

const ALLOWED_MODEL_IDS: ReadonlySet<string> = new Set(IMAGE_MODELS.map((m) => m.id));

export function createAdminAssetsRoutes(
  assetService: AssetService,
  dataDir: string,
  imageGenApiKey?: string
) {
  const router = Router();

  const tempDir = path.join(dataDir, "temp");
  fs.mkdirSync(tempDir, { recursive: true });

  // 20MB multer limit — service enforces the 5MB business rule so the error is a proper 422
  const upload = multer({
    dest: tempDir,
    limits: { fileSize: 20 * 1024 * 1024 },
  });

  router.post("/assets/upload", (req, res, next) => {
    upload.single("file")(req, res, async (multerErr) => {
      try {
        if (multerErr instanceof multer.MulterError) {
          return next(new ValidationError(`Upload failed: ${multerErr.message}`));
        }
        if (multerErr) {
          return next(multerErr);
        }

        if (!req.file) {
          throw new ValidationError("No file provided");
        }

        const asset = await assetService.processUpload(req.file);
        res.status(201).json({ data: asset });
      } catch (err) {
        next(err);
      }
    });
  });

  router.get("/assets", (req, res, next) => {
    try {
      const { source, status } = req.query;

      const assets = assetService.getAssets({
        source: typeof source === "string" ? source : undefined,
        status: typeof status === "string" ? status : undefined,
      });

      res.json({ data: assets });
    } catch (err) {
      next(err);
    }
  });

  router.post("/assets/:id/archive", (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id, "asset ID");
      assetService.archiveAsset(id);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/assets/:id/usage", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/u.test(idParam)) {
        throw new ValidationError("Invalid asset ID");
      }

      const usage = assetService.getAssetUsage(Number(idParam));
      res.json({
        data: {
          assetId: Number(idParam),
          usedBy: usage.map((u) => ({
            entityType: u.entity_type,
            entityId: u.entity_id,
            entityName: u.entity_name,
          })),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete("/assets/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/u.test(idParam)) {
        throw new ValidationError("Invalid asset ID");
      }

      assetService.deleteAsset(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/assets/generate", async (req, res, next) => {
    try {
      const { prompt, model } = req.body;

      if (typeof prompt !== "string" || prompt.trim().length === 0) {
        throw new ValidationError("prompt is required");
      }
      if (prompt.trim().length > 1000) {
        throw new ValidationError("prompt must be 1000 characters or fewer");
      }
      if (model !== undefined && typeof model !== "string") {
        throw new ValidationError("model must be a string");
      }
      if (model !== undefined && !ALLOWED_MODEL_IDS.has(model)) {
        throw new ValidationError(`Unknown model: ${model}. Allowed: ${[...ALLOWED_MODEL_IDS].join(", ")}`);
      }

      if (!imageGenApiKey) {
        throw new AppError(503, "SERVICE_UNAVAILABLE", "Image generation is not configured");
      }

      const asset = await assetService.generateImage(prompt.trim(), model, imageGenApiKey);
      res.status(201).json({ data: asset });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
