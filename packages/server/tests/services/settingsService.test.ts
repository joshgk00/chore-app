import { describe, it, expect } from 'vitest';
import { createTestDb } from '../db-helpers.js';
import { bootstrapSettings, getSetting } from '../../src/services/settingsService.js';
import type { AppConfig } from '../../src/config.js';

function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
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

describe('settingsService', () => {
  it('bootstrapSettings inserts defaults when settings is empty', () => {
    const db = createTestDb();
    const config = makeConfig();
    bootstrapSettings(db, config);

    const count = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
    expect(count.count).toBeGreaterThan(0);
    db.close();
  });

  it('bootstrapSettings skips when settings already exist', () => {
    const db = createTestDb();
    const config = makeConfig();
    bootstrapSettings(db, config);

    const before = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
    bootstrapSettings(db, config); // second call
    const after = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };

    expect(after.count).toBe(before.count);
    db.close();
  });

  it('getSetting returns the configured timezone', () => {
    const db = createTestDb();
    bootstrapSettings(db, makeConfig({ timezone: 'US/Pacific' }));

    expect(getSetting(db, 'timezone')).toBe('US/Pacific');
    db.close();
  });

  it('default time slot windows match spec', () => {
    const db = createTestDb();
    bootstrapSettings(db, makeConfig());

    expect(getSetting(db, 'morning_start')).toBe('05:00');
    expect(getSetting(db, 'morning_end')).toBe('10:59');
    expect(getSetting(db, 'afternoon_start')).toBe('15:00');
    expect(getSetting(db, 'afternoon_end')).toBe('18:29');
    expect(getSetting(db, 'bedtime_start')).toBe('18:30');
    expect(getSetting(db, 'bedtime_end')).toBe('21:30');
    db.close();
  });
});
