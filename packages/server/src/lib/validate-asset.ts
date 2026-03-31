import type Database from "better-sqlite3";
import { ValidationError } from "./errors.js";

export function createAssetValidator(
  db: Database.Database,
): (assetId: number | null | undefined) => void {
  const selectAssetExistsStmt = db.prepare(
    `SELECT id, archived_at FROM assets WHERE id = ?`,
  );

  return function validateAssetId(assetId: number | null | undefined): void {
    if (assetId == null) return;
    const asset = selectAssetExistsStmt.get(assetId) as
      | { id: number; archived_at: string | null }
      | undefined;
    if (!asset) {
      throw new ValidationError("Referenced asset does not exist");
    }
    if (asset.archived_at !== null) {
      throw new ValidationError("Referenced asset is archived");
    }
  };
}
