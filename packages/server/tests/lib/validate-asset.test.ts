import { describe, it, expect } from "vitest";
import { createTestDb } from "../db-helpers.js";
import { createAssetValidator } from "../../src/lib/validate-asset.js";
import { ValidationError } from "../../src/lib/errors.js";
import type Database from "better-sqlite3";

let db: Database.Database;
let validateAssetId: (assetId: number | null | undefined) => void;

function seedAsset(id: number, archivedAt: string | null = null): void {
  db.prepare(
    "INSERT INTO assets (id, source, status, original_filename, stored_filename, mime_type, size_bytes, archived_at) VALUES (?, 'upload', 'ready', ?, ?, 'image/png', 1024, ?)",
  ).run(id, "test.png", `stored-${id}.png`, archivedAt);
}

describe("createAssetValidator", () => {
  beforeEach(() => {
    db = createTestDb();
    validateAssetId = createAssetValidator(db);
  });

  afterEach(() => {
    db.close();
  });

  it("accepts null asset ID", () => {
    expect(() => validateAssetId(null)).not.toThrow();
  });

  it("accepts undefined asset ID", () => {
    expect(() => validateAssetId(undefined)).not.toThrow();
  });

  it("accepts a valid active asset", () => {
    seedAsset(1);
    expect(() => validateAssetId(1)).not.toThrow();
  });

  it("throws ValidationError for nonexistent asset", () => {
    expect(() => validateAssetId(999)).toThrow(ValidationError);
    expect(() => validateAssetId(999)).toThrow("Referenced asset does not exist");
  });

  it("throws ValidationError for archived asset", () => {
    seedAsset(2, "2026-01-01T00:00:00Z");
    expect(() => validateAssetId(2)).toThrow(ValidationError);
    expect(() => validateAssetId(2)).toThrow("Referenced asset is archived");
  });
});
