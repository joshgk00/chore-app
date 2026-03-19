import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPin } from '../src/lib/crypto.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'migrations');

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');

  // Create migrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Apply all migrations
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (version) VALUES (?)').run(file.replace('.sql', ''));
  }

  return db;
}

export function seedTestData(db: Database.Database): void {
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insert.run('admin_pin_hash', hashPin('123456'));
  insert.run('timezone', 'America/New_York');
  insert.run('activity_retention_days', '365');
  insert.run('morning_start', '05:00');
  insert.run('morning_end', '10:59');
  insert.run('afternoon_start', '15:00');
  insert.run('afternoon_end', '18:29');
  insert.run('bedtime_start', '18:30');
  insert.run('bedtime_end', '21:30');
}
