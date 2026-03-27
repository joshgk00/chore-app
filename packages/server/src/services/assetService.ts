import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type Database from "better-sqlite3";
import type { ActivityService } from "./activityService.js";
import { AppError, NotFoundError, ValidationError } from "../lib/errors.js";

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_LONG_EDGE_PX = 1200;
const DEFAULT_GENERATION_MODEL = "nano-banana-pro";
const PPQ_API_BASE_URL = "https://api.ppq.ai/v1";
const GENERATION_TIMEOUT_MS = 60_000;
const DOWNLOAD_TIMEOUT_MS = 30_000;

interface AssetRow {
  id: number;
  source: string;
  reusable: number;
  status: string;
  original_filename: string | null;
  stored_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  prompt: string | null;
  model: string | null;
  created_at: string;
  archived_at: string | null;
}

export interface Asset {
  id: number;
  source: "upload" | "ai_generated";
  reusable: boolean;
  status: "processing" | "ready" | "failed";
  originalFilename: string | null;
  storedFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  prompt: string | null;
  model: string | null;
  createdAt: string;
  archivedAt: string | null;
  url: string | null;
}

export interface AssetFilters {
  source?: string;
  status?: string;
}

export interface UploadFile {
  path: string;
  originalname: string;
  size: number;
}

export interface AssetService {
  processUpload(file: UploadFile): Promise<Asset>;
  generateImage(prompt: string, model: string | undefined, apiKey: string): Promise<Asset>;
  getAssets(filters?: AssetFilters): Asset[];
  archiveAsset(id: number): void;
}

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

function mapAssetRow(row: AssetRow): Asset {
  return {
    id: row.id,
    source: row.source as "upload" | "ai_generated",
    reusable: row.reusable === 1,
    status: row.status as "processing" | "ready" | "failed",
    originalFilename: row.original_filename,
    storedFilename: row.stored_filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    prompt: row.prompt,
    model: row.model,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
    url: row.stored_filename ? `/assets/${row.stored_filename}` : null,
  };
}

async function processImageToWebp(
  inputPath: string,
  outputDir: string
): Promise<{ storedFilename: string; sizeBytes: number; width: number; height: number }> {
  const storedFilename = `${randomUUID()}.webp`;
  const outputPath = path.join(outputDir, storedFilename);

  const { data: processedBuffer, info } = await sharp(inputPath)
    .rotate()
    .resize(MAX_LONG_EDGE_PX, MAX_LONG_EDGE_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  fs.writeFileSync(outputPath, processedBuffer);

  return {
    storedFilename,
    sizeBytes: processedBuffer.length,
    width: info.width,
    height: info.height,
  };
}

async function fetchGeneratedImageBytes(
  prompt: string,
  model: string,
  apiKey: string
): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

  try {
    const response = await fetch(`${PPQ_API_BASE_URL}/images/generations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new AppError(
        502,
        "GENERATION_FAILED",
        `Image generation failed: API returned ${response.status}`
      );
    }

    const data = (await response.json()) as {
      data: Array<{ url?: string; b64_json?: string }>;
    };

    const result = data.data?.[0];
    if (!result) {
      throw new AppError(502, "GENERATION_FAILED", "Image generation failed: empty API response");
    }

    if (result.b64_json) {
      return Buffer.from(result.b64_json, "base64");
    }

    if (!result.url) {
      throw new AppError(
        502,
        "GENERATION_FAILED",
        "Image generation failed: no image in API response"
      );
    }

    clearTimeout(timeout);

    const downloadController = new AbortController();
    const downloadTimeout = setTimeout(() => downloadController.abort(), DOWNLOAD_TIMEOUT_MS);
    try {
      const imageResponse = await fetch(result.url, { signal: downloadController.signal });
      if (!imageResponse.ok) {
        throw new AppError(
          502,
          "GENERATION_FAILED",
          `Image generation failed: could not download image (${imageResponse.status})`
        );
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } finally {
      clearTimeout(downloadTimeout);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AppError(502, "GENERATION_FAILED", "Image generation failed: request timed out");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Soft-delete temp files: on Windows, sharp may briefly hold a handle.
// The file is in a temp dir and will be cleaned up regardless.
function deleteTempFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Ignore — file is disposable and lives in a temp/upload directory
  }
}

export function createAssetService(
  db: Database.Database,
  dataDir: string,
  activityService: ActivityService
): AssetService {
  const insertAssetStmt = db.prepare(
    `INSERT INTO assets (source, reusable, status, original_filename, stored_filename, mime_type, size_bytes, width, height, prompt, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const archiveAssetStmt = db.prepare(
    `UPDATE assets SET archived_at = datetime('now') WHERE id = ? AND archived_at IS NULL`
  );

  const selectByIdStmt = db.prepare(`SELECT * FROM assets WHERE id = ?`);

  async function processUpload(file: UploadFile): Promise<Asset> {
    const assetsDir = path.join(dataDir, "assets");
    fs.mkdirSync(assetsDir, { recursive: true });

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      deleteTempFile(file.path);
      throw new ValidationError("File exceeds 5MB limit");
    }

    const headerBuffer = Buffer.alloc(12);
    const fd = fs.openSync(file.path, "r");
    try {
      fs.readSync(fd, headerBuffer, 0, 12, 0);
    } finally {
      fs.closeSync(fd);
    }

    const detectedMime = detectMimeType(headerBuffer);
    if (!detectedMime || !ACCEPTED_MIME_TYPES.has(detectedMime)) {
      deleteTempFile(file.path);
      throw new ValidationError("File must be a valid JPEG, PNG, or WebP image");
    }

    try {
      let processed: Awaited<ReturnType<typeof processImageToWebp>>;
      try {
        processed = await processImageToWebp(file.path, assetsDir);
      } catch {
        throw new ValidationError("Invalid or corrupt image file");
      }
      const { storedFilename, sizeBytes, width, height } = processed;

      const result = insertAssetStmt.run(
        "upload",
        0,
        "ready",
        file.originalname,
        storedFilename,
        "image/webp",
        sizeBytes,
        width,
        height,
        null,
        null
      );

      activityService.recordActivity({
        eventType: "asset_uploaded",
        entityType: "asset",
        entityId: result.lastInsertRowid as number,
        summary: `Uploaded asset: ${file.originalname}`,
      });

      return mapAssetRow(selectByIdStmt.get(result.lastInsertRowid) as AssetRow);
    } finally {
      deleteTempFile(file.path);
    }
  }

  async function generateImage(
    prompt: string,
    model: string | undefined,
    apiKey: string
  ): Promise<Asset> {
    const assetsDir = path.join(dataDir, "assets");
    const tempDir = path.join(dataDir, "temp");
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const resolvedModel = model ?? DEFAULT_GENERATION_MODEL;
    const imageBytes = await fetchGeneratedImageBytes(prompt, resolvedModel, apiKey);

    const tempPath = path.join(tempDir, `${randomUUID()}.tmp`);
    fs.writeFileSync(tempPath, imageBytes);

    try {
      const { storedFilename, sizeBytes, width, height } =
        await processImageToWebp(tempPath, assetsDir);

      const result = insertAssetStmt.run(
        "ai_generated",
        0,
        "ready",
        null,
        storedFilename,
        "image/webp",
        sizeBytes,
        width,
        height,
        prompt,
        resolvedModel
      );

      activityService.recordActivity({
        eventType: "asset_generated",
        entityType: "asset",
        entityId: result.lastInsertRowid as number,
        summary: `Generated asset: "${prompt.substring(0, 50)}"`,
      });

      return mapAssetRow(selectByIdStmt.get(result.lastInsertRowid) as AssetRow);
    } finally {
      deleteTempFile(tempPath);
    }
  }

  function getAssets(filters?: AssetFilters): Asset[] {
    // WHERE clause varies by filter combination, so the statement is built dynamically.
    // This is intentional — a single cached statement can't cover all filter permutations.
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.source) {
      const dbSource = filters.source === "generated" ? "ai_generated" : filters.source;
      conditions.push("source = ?");
      params.push(dbSource);
    }

    if (filters?.status === "active") {
      conditions.push("archived_at IS NULL");
    } else if (filters?.status === "archived") {
      conditions.push("archived_at IS NOT NULL");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = db
      .prepare(`SELECT * FROM assets ${where} ORDER BY created_at DESC`)
      .all(...params) as AssetRow[];

    return rows.map(mapAssetRow);
  }

  function archiveAsset(id: number): void {
    const asset = selectByIdStmt.get(id) as AssetRow | undefined;
    if (!asset) {
      throw new NotFoundError("Asset not found");
    }
    if (asset.archived_at) {
      throw new NotFoundError("Asset is already archived");
    }

    archiveAssetStmt.run(id);

    activityService.recordActivity({
      eventType: "asset_archived",
      entityType: "asset",
      entityId: id,
      summary: `Archived asset: ${asset.stored_filename}`,
    });
  }

  return { processUpload, generateImage, getAssets, archiveAsset };
}
