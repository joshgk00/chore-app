import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import Database from "better-sqlite3";
import { createTestDb, seedTestData } from "../db-helpers.js";
import { createActivityService } from "../../src/services/activityService.js";
import { createAssetService } from "../../src/services/assetService.js";
import { AppError, ValidationError, NotFoundError } from "../../src/lib/errors.js";
import { createTestImageFixtures, type TestImageFixtures } from "../helpers/fixture-images.js";
import sharp from "sharp";

let fixtures: TestImageFixtures;

beforeAll(async () => {
  fixtures = await createTestImageFixtures();
});

afterAll(() => {
  fixtures.cleanup();
});

function createTestAssetDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "chore-app-assets-test-"));
}

// The service deletes the input file (mimicking multer temp cleanup), so tests
// must pass a disposable copy — never the original fixture.
function copyToTemp(srcPath: string, destDir: string, name: string): string {
  const dest = path.join(destDir, name);
  fs.copyFileSync(srcPath, dest);
  return dest;
}

describe("assetService", () => {
  let db: Database.Database;
  let dataDir: string;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestData(db);
    dataDir = createTestAssetDir();
  });

  afterEach(() => {
    db.close();
    // Windows may keep file handles open briefly after sharp processes images;
    // best-effort cleanup, OS will reclaim the temp dir on next reboot if needed.
    try {
      fs.rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  function buildService() {
    const activityService = createActivityService(db);
    return createAssetService(db, dataDir, activityService);
  }

  describe("processUpload", () => {
    it("processes a valid JPEG and stores as .webp", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "input.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "photo.jpg",
        size: stat.size,
      });

      expect(asset.storedFilename).toMatch(/\.webp$/u);
      expect(asset.source).toBe("upload");
      expect(asset.status).toBe("ready");
      expect(asset.mimeType).toBe("image/webp");
      expect(asset.originalFilename).toBe("photo.jpg");

      const savedPath = path.join(dataDir, "assets", asset.storedFilename);
      expect(fs.existsSync(savedPath)).toBe(true);
    });

    it("processes a valid PNG and converts to .webp", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validPngPath, dataDir, "input.png");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "image.png",
        size: stat.size,
      });

      expect(asset.storedFilename).toMatch(/\.webp$/u);
      expect(asset.mimeType).toBe("image/webp");
    });

    it("processes a valid WebP", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validWebpPath, dataDir, "input.webp");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "image.webp",
        size: stat.size,
      });

      expect(asset.storedFilename).toMatch(/\.webp$/u);
      expect(asset.status).toBe("ready");
    });

    it("rejects a file > 5MB with ValidationError", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.oversizedJpgPath, dataDir, "huge.jpg");
      const stat = fs.statSync(tmpPath);

      await expect(
        service.processUpload({
          path: tmpPath,
          originalname: "huge.jpg",
          size: stat.size,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("rejects a non-image file (MIME check by content)", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.notAnImagePath, dataDir, "spoofed.jpg");
      const stat = fs.statSync(tmpPath);

      await expect(
        service.processUpload({
          path: tmpPath,
          originalname: "spoofed.jpg",
          size: stat.size,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("uses a randomized UUID filename, not the original", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "input.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "original-name.jpg",
        size: stat.size,
      });

      expect(asset.storedFilename).not.toBe("original-name.jpg");
      expect(asset.storedFilename).not.toContain("original-name");
      expect(asset.originalFilename).toBe("original-name.jpg");
    });

    it("preserves original_filename in the asset record", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "input.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "my-vacation.jpg",
        size: stat.size,
      });

      expect(asset.originalFilename).toBe("my-vacation.jpg");
    });

    it("resizes an image larger than 1200px on the long edge", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.largeJpgPath, dataDir, "large.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "large.jpg",
        size: stat.size,
      });

      expect(asset.width).toBeLessThanOrEqual(1200);
      expect(asset.height).toBeLessThanOrEqual(1200);
    });

    it("does not upscale small images", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "tiny.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "tiny.jpg",
        size: stat.size,
      });

      // 100x100 input should stay at 100x100 (not upscaled)
      expect(asset.width).toBe(100);
      expect(asset.height).toBe(100);
    });

    it("includes a url field pointing to /assets/{filename}", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "input.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "photo.jpg",
        size: stat.size,
      });

      expect(asset.url).toBe(`/assets/${asset.storedFilename}`);
    });
  });

  describe("archiveAsset", () => {
    it("sets archived_at timestamp on the asset", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "input.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "to-archive.jpg",
        size: stat.size,
      });

      expect(asset.archivedAt).toBeNull();
      service.archiveAsset(asset.id);

      const [archived] = service.getAssets({ status: "archived" });
      expect(archived.id).toBe(asset.id);
      expect(archived.archivedAt).toBeTruthy();
    });

    it("throws NotFoundError for nonexistent asset", () => {
      const service = buildService();
      expect(() => service.archiveAsset(9999)).toThrow(NotFoundError);
    });

    it("throws NotFoundError when archiving an already-archived asset", async () => {
      const service = buildService();
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, "input.jpg");
      const stat = fs.statSync(tmpPath);

      const asset = await service.processUpload({
        path: tmpPath,
        originalname: "double-archive.jpg",
        size: stat.size,
      });
      service.archiveAsset(asset.id);

      expect(() => service.archiveAsset(asset.id)).toThrow(NotFoundError);
    });
  });

  describe("getAssets", () => {
    async function seedUpload(service: ReturnType<typeof buildService>, name: string) {
      const tmpPath = copyToTemp(fixtures.validJpgPath, dataDir, `seed-${Date.now()}-${name}`);
      const stat = fs.statSync(tmpPath);
      return service.processUpload({
        path: tmpPath,
        originalname: name,
        size: stat.size,
      });
    }

    it("returns all assets when no filters given", async () => {
      const service = buildService();
      await seedUpload(service, "a.jpg");
      await seedUpload(service, "b.jpg");

      const assets = service.getAssets();
      expect(assets).toHaveLength(2);
    });

    it("filters by source=upload excludes generated assets", async () => {
      const service = buildService();
      await seedUpload(service, "uploaded.jpg");

      // Insert a fake generated asset directly
      db.prepare(
        `INSERT INTO assets (source, reusable, status, stored_filename, mime_type)
         VALUES ('ai_generated', 0, 'ready', 'gen-uuid.webp', 'image/webp')`
      ).run();

      const uploaded = service.getAssets({ source: "upload" });
      expect(uploaded.every((a) => a.source === "upload")).toBe(true);
      expect(uploaded).toHaveLength(1);
    });

    it("filters by source=generated returns only ai_generated assets", async () => {
      const service = buildService();
      await seedUpload(service, "uploaded.jpg");
      db.prepare(
        `INSERT INTO assets (source, reusable, status, stored_filename, mime_type)
         VALUES ('ai_generated', 0, 'ready', 'gen-uuid.webp', 'image/webp')`
      ).run();

      const generated = service.getAssets({ source: "generated" });
      expect(generated.every((a) => a.source === "ai_generated")).toBe(true);
      expect(generated).toHaveLength(1);
    });

    it("filters by status=archived returns only archived assets", async () => {
      const service = buildService();
      const asset = await seedUpload(service, "to-archive.jpg");
      await seedUpload(service, "active.jpg");
      service.archiveAsset(asset.id);

      const archived = service.getAssets({ status: "archived" });
      expect(archived).toHaveLength(1);
      expect(archived[0].id).toBe(asset.id);
    });

    it("filters by status=active returns only non-archived assets", async () => {
      const service = buildService();
      const asset = await seedUpload(service, "to-archive.jpg");
      await seedUpload(service, "active.jpg");
      service.archiveAsset(asset.id);

      const active = service.getAssets({ status: "active" });
      expect(active).toHaveLength(1);
      expect(active[0].id).not.toBe(asset.id);
    });
  });

  describe("generateImage", () => {
    let validPngBuffer: Buffer;

    beforeAll(async () => {
      validPngBuffer = await sharp({
        create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 128, b: 255 } },
      }).png().toBuffer();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function mockFetchForUrlResponse(imageBuffer: Buffer, imageHost = "api.ppq.ai") {
      const generationResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ url: `https://${imageHost}/v1/media/gen_abc/0?sig=test` }],
        }),
      };
      const downloadResponse = {
        ok: true,
        status: 200,
        arrayBuffer: async () => imageBuffer.buffer.slice(
          imageBuffer.byteOffset,
          imageBuffer.byteOffset + imageBuffer.byteLength
        ),
      };
      let callCount = 0;
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        callCount++;
        return (callCount === 1 ? generationResponse : downloadResponse) as Response;
      });
    }

    it("downloads image from signed URL and stores as webp", async () => {
      const service = buildService();
      mockFetchForUrlResponse(validPngBuffer);

      const asset = await service.generateImage("a blue square", undefined, "sk-test");

      expect(asset.source).toBe("ai_generated");
      expect(asset.status).toBe("ready");
      expect(asset.storedFilename).toMatch(/\.webp$/u);
      expect(asset.prompt).toBe("a blue square");
      expect(asset.model).toBe("nano-banana-pro");
      expect(fs.existsSync(path.join(dataDir, "assets", asset.storedFilename))).toBe(true);
    });

    it("rejects URLs from non-ppq.ai hosts", async () => {
      const service = buildService();
      mockFetchForUrlResponse(validPngBuffer, "evilppq.ai");

      await expect(
        service.generateImage("test", undefined, "sk-test")
      ).rejects.toThrow("unexpected image URL");
    });

    it("throws on malformed JSON from API", async () => {
      const service = buildService();
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError("Unexpected token"); },
      } as Response);

      await expect(
        service.generateImage("test", undefined, "sk-test")
      ).rejects.toThrow("invalid JSON from API");
    });

    it("throws on invalid URL from API", async () => {
      const service = buildService();
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [{ url: "not-a-valid-url" }] }),
      } as Response);

      await expect(
        service.generateImage("test", undefined, "sk-test")
      ).rejects.toThrow("invalid image URL from API");
    });

    it("throws on empty API response", async () => {
      const service = buildService();
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: [] }),
      } as Response);

      await expect(
        service.generateImage("test", undefined, "sk-test")
      ).rejects.toThrow("empty API response");
    });
  });
});
