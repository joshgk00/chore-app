import type Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getLogger } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrationsDir = path.join(__dirname, "migrations");

  if (!fs.existsSync(migrationsDir)) {
    getLogger().debug("no migrations directory found, skipping");
    return;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (db.prepare("SELECT version FROM _migrations").all() as Array<{ version: string }>).map(
      (row) => row.version,
    ),
  );

  for (const file of files) {
    const version = file.replace(".sql", "");
    if (applied.has(version)) {
      continue;
    }

    getLogger().info({ migration: file }, "applying migration");
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");

    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO _migrations (version) VALUES (?)").run(version);
    });

    applyMigration();
    getLogger().info({ migration: file }, "migration applied");
  }
}
