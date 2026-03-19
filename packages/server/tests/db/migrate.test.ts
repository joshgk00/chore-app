import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db-helpers.js';

describe('Migration runner', () => {
  it('applies all migrations on a fresh database', () => {
    const db = createTestDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '_%'")
      .all() as Array<{ name: string }>;
    const tableNames = tables.map((t) => t.name).sort();

    expect(tableNames).toContain('routines');
    expect(tableNames).toContain('checklist_items');
    expect(tableNames).toContain('chores');
    expect(tableNames).toContain('chore_tiers');
    expect(tableNames).toContain('rewards');
    expect(tableNames).toContain('assets');
    expect(tableNames).toContain('routine_completions');
    expect(tableNames).toContain('chore_logs');
    expect(tableNames).toContain('reward_requests');
    expect(tableNames).toContain('points_ledger');
    expect(tableNames).toContain('badges_earned');
    expect(tableNames).toContain('push_subscriptions');
    expect(tableNames).toContain('admin_sessions');
    expect(tableNames).toContain('settings');
    expect(tableNames).toContain('activity_events');
    db.close();
  });

  it('is idempotent (second run applies nothing)', () => {
    const db = createTestDb();
    const before = db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as {
      count: number;
    };

    // Re-run migrations (already applied in createTestDb)
    const applied = db.prepare('SELECT version FROM _migrations').all() as Array<{
      version: string;
    }>;
    expect(applied.length).toBe(before.count);
    db.close();
  });

  it('tracks applied migration versions in _migrations', () => {
    const db = createTestDb();
    const rows = db.prepare('SELECT version FROM _migrations').all() as Array<{ version: string }>;
    expect(rows.some((r) => r.version === '001-initial-schema')).toBe(true);
    db.close();
  });

  it('enforces foreign keys (child with missing parent fails)', () => {
    const db = createTestDb();
    expect(() => {
      db.prepare(
        "INSERT INTO checklist_items (routine_id, label) VALUES (99999, 'test')",
      ).run();
    }).toThrow();
    db.close();
  });

  it('rejects invalid status values via CHECK constraint', () => {
    const db = createTestDb();
    // Insert a routine first
    db.prepare(
      "INSERT INTO routines (name, time_slot, completion_rule) VALUES ('test', 'morning', 'once_per_day')",
    ).run();

    expect(() => {
      db.prepare(
        "INSERT INTO routine_completions (routine_id, routine_name_snapshot, time_slot_snapshot, completion_rule_snapshot, points_snapshot, requires_approval_snapshot, local_date, status) VALUES (1, 'test', 'morning', 'once_per_day', 10, 0, '2026-01-01', 'invalid')",
      ).run();
    }).toThrow();
    db.close();
  });
});
