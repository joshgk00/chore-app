import Database from 'better-sqlite3';
import { hashPin } from '../src/lib/crypto.js';
import type { AppConfig } from '../src/config.js';
import { runMigrations } from '../src/db/migrate.js';

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

export async function seedTestData(db: Database.Database): Promise<void> {
  const insert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insert.run('admin_pin_hash', await hashPin('123456'));
  insert.run('timezone', 'America/New_York');
  insert.run('activity_retention_days', '365');
  insert.run('morning_start', '05:00');
  insert.run('morning_end', '10:59');
  insert.run('afternoon_start', '15:00');
  insert.run('afternoon_end', '18:29');
  insert.run('bedtime_start', '18:30');
  insert.run('bedtime_end', '21:30');
}

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 3000,
    publicOrigin: 'http://localhost:3000',
    dataDir: './data',
    timezone: 'America/New_York',
    initialAdminPin: '123456',
    activityRetentionDays: 365,
    ...overrides,
  };
}
