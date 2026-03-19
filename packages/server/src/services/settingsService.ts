import type Database from "better-sqlite3";
import { DEFAULT_TIME_SLOTS } from "@chore-app/shared";
import { hashPin } from "../lib/crypto.js";
import type { AppConfig } from "../config.js";

export function bootstrapSettings(db: Database.Database, config: AppConfig): void {
  const existing = db.prepare("SELECT COUNT(*) as count FROM settings").get() as { count: number };
  if (existing.count > 0) {
    console.log("Settings already exist, skipping bootstrap.");
    return;
  }

  console.log("Bootstrapping default settings...");

  const insert = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");

  const bootstrap = db.transaction(() => {
    insert.run("admin_pin_hash", hashPin(config.initialAdminPin));
    insert.run("timezone", config.timezone);
    insert.run("activity_retention_days", String(config.activityRetentionDays));
    insert.run("morning_start", DEFAULT_TIME_SLOTS.morning_start);
    insert.run("morning_end", DEFAULT_TIME_SLOTS.morning_end);
    insert.run("afternoon_start", DEFAULT_TIME_SLOTS.afternoon_start);
    insert.run("afternoon_end", DEFAULT_TIME_SLOTS.afternoon_end);
    insert.run("bedtime_start", DEFAULT_TIME_SLOTS.bedtime_start);
    insert.run("bedtime_end", DEFAULT_TIME_SLOTS.bedtime_end);
  });

  bootstrap();
  console.log("Settings bootstrapped.");
}

export function getAllSettings(db: Database.Database): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{
    key: string;
    value: string;
  }>;
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export function getSetting(db: Database.Database, key: string): string | undefined {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value;
}

export function setSetting(db: Database.Database, key: string, value: string): void {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value);
}
