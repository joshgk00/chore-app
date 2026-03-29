import type Database from "better-sqlite3";
import { DEFAULT_TIME_SLOTS, PIN_MIN_LENGTH } from "@chore-app/shared";
import { hashPin } from "../lib/crypto.js";
import { ValidationError } from "../lib/errors.js";
import type { AppConfig } from "../config.js";
import { getLogger } from "../lib/logger.js";

const SENSITIVE_KEYS = new Set(["admin_pin_hash"]);

const UPDATABLE_KEYS = new Set([
  "timezone",
  "activity_retention_days",
  "bonus_approval_points",
  "morning_start",
  "morning_end",
  "afternoon_start",
  "afternoon_end",
  "bedtime_start",
  "bedtime_end",
]);

const TIME_SLOT_KEYS = new Set([
  "morning_start",
  "morning_end",
  "afternoon_start",
  "afternoon_end",
  "bedtime_start",
  "bedtime_end",
]);

const TIME_FORMAT = /^\d{2}:\d{2}$/;

export interface SettingsService {
  bootstrapSettings(config: AppConfig): Promise<void>;
  getAllSettings(): Record<string, string>;
  getPublicSettings(): Record<string, string>;
  getSetting(key: string): string | undefined;
  setSetting(key: string, value: string): void;
  updateSettings(updates: Record<string, string>): Record<string, string>;
  updatePin(newPin: string): Promise<void>;
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
      getLogger().debug("settings already exist, skipping bootstrap");
      return;
    }

    getLogger().info("bootstrapping default settings");

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
      insertStmt.run("bonus_approval_points", "0");
    });

    bootstrap();
    getLogger().info("settings bootstrapped");
  }

  function updateSettings(updates: Record<string, string>): Record<string, string> {
    const unknownKeys = Object.keys(updates).filter((k) => !UPDATABLE_KEYS.has(k));
    if (unknownKeys.length > 0) {
      throw new ValidationError(`Unknown settings keys: ${unknownKeys.join(", ")}`);
    }

    const fieldErrors: Record<string, string> = {};

    for (const [key, value] of Object.entries(updates)) {
      if (TIME_SLOT_KEYS.has(key)) {
        if (typeof value !== "string" || !TIME_FORMAT.test(value)) {
          fieldErrors[key] = "Must be in HH:MM format";
        } else {
          const [hours, minutes] = value.split(":").map(Number);
          if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
            fieldErrors[key] = "Hours must be 00-23 and minutes 00-59";
          }
        }
      } else if (key === "timezone") {
        if (typeof value !== "string" || value.trim().length === 0) {
          fieldErrors[key] = "Timezone must be a non-empty string";
        }
      } else if (key === "activity_retention_days") {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 1) {
          fieldErrors[key] = "Must be a positive integer";
        }
      } else if (key === "bonus_approval_points") {
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed < 0) {
          fieldErrors[key] = "Must be a non-negative integer";
        }
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      throw new ValidationError("Invalid settings values", fieldErrors);
    }

    const applyUpdates = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        setSetting(key, value);
      }
    });
    applyUpdates();

    return getPublicSettings();
  }

  async function updatePin(newPin: string): Promise<void> {
    if (!newPin || typeof newPin !== "string") {
      throw new ValidationError(`PIN must be at least ${PIN_MIN_LENGTH} digits`);
    }

    const trimmed = newPin.trim();
    if (trimmed.length < PIN_MIN_LENGTH) {
      throw new ValidationError(`PIN must be at least ${PIN_MIN_LENGTH} digits`);
    }
    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError("PIN must contain only digits");
    }

    const hash = await hashPin(trimmed);
    setSetting("admin_pin_hash", hash);
  }

  return {
    bootstrapSettings,
    getAllSettings,
    getPublicSettings,
    getSetting,
    setSetting,
    updateSettings,
    updatePin,
  };
}
