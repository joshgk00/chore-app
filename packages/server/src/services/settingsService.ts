import type Database from "better-sqlite3";
import { DEFAULT_TIME_SLOTS } from "@chore-app/shared";
import { hashPin } from "../lib/crypto.js";
import type { AppConfig } from "../config.js";

const SENSITIVE_KEYS = new Set(["admin_pin_hash"]);

export interface SettingsService {
  bootstrapSettings(config: AppConfig): Promise<void>;
  getAllSettings(): Record<string, string>;
  getPublicSettings(): Record<string, string>;
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
}

export function createSettingsService(db: Database.Database): SettingsService {
  const countStmt = db.prepare("SELECT COUNT(*) as count FROM settings");
  const selectAllStmt = db.prepare("SELECT key, value FROM settings");
  const selectOneStmt = db.prepare("SELECT value FROM settings WHERE key = ?");
  const upsertStmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const insertStmt = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");

  function getAllSettings(): Record<string, string> {
    const rows = selectAllStmt.all() as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  function getPublicSettings(): Record<string, string> {
    const rows = selectAllStmt.all() as Array<{ key: string; value: string }>;
    const result: Record<string, string> = {};
    for (const row of rows) {
      if (!SENSITIVE_KEYS.has(row.key)) {
        result[row.key] = row.value;
      }
    }
    return result;
  }

  function getSetting(key: string): string | undefined {
    const row = selectOneStmt.get(key) as { value: string } | undefined;
    return row?.value;
  }

  function setSetting(key: string, value: string): void {
    upsertStmt.run(key, value);
  }

  async function bootstrapSettings(config: AppConfig): Promise<void> {
    const existing = countStmt.get() as { count: number };
    if (existing.count > 0) {
      console.log("Settings already exist, skipping bootstrap.");
      return;
    }

    console.log("Bootstrapping default settings...");

    const pinHash = await hashPin(config.initialAdminPin);

    const bootstrap = db.transaction(() => {
      insertStmt.run("admin_pin_hash", pinHash);
      insertStmt.run("timezone", config.timezone);
      insertStmt.run("activity_retention_days", String(config.activityRetentionDays));
      insertStmt.run("morning_start", DEFAULT_TIME_SLOTS.morning_start);
      insertStmt.run("morning_end", DEFAULT_TIME_SLOTS.morning_end);
      insertStmt.run("afternoon_start", DEFAULT_TIME_SLOTS.afternoon_start);
      insertStmt.run("afternoon_end", DEFAULT_TIME_SLOTS.afternoon_end);
      insertStmt.run("bedtime_start", DEFAULT_TIME_SLOTS.bedtime_start);
      insertStmt.run("bedtime_end", DEFAULT_TIME_SLOTS.bedtime_end);
    });

    bootstrap();
    console.log("Settings bootstrapped.");
  }

  return { bootstrapSettings, getAllSettings, getPublicSettings, getSetting, setSetting };
}
