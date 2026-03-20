import { describe, it, expect } from 'vitest';
import { createTestDb, createTestConfig } from '../db-helpers.js';
import { createSettingsService } from '../../src/services/settingsService.js';

describe('settingsService', () => {
  it('bootstrapSettings inserts defaults when settings is empty', async () => {
    const db = createTestDb();
    const config = createTestConfig();
    const service = createSettingsService(db);
    await service.bootstrapSettings(config);

    const count = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
    expect(count.count).toBeGreaterThan(0);
    db.close();
  });

  it('bootstrapSettings skips when settings already exist', async () => {
    const db = createTestDb();
    const config = createTestConfig();
    const service = createSettingsService(db);
    await service.bootstrapSettings(config);

    const before = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
    await service.bootstrapSettings(config);
    const after = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };

    expect(after.count).toBe(before.count);
    db.close();
  });

  it('getSetting returns the configured timezone', async () => {
    const db = createTestDb();
    const service = createSettingsService(db);
    await service.bootstrapSettings(createTestConfig({ timezone: 'US/Pacific' }));

    expect(service.getSetting('timezone')).toBe('US/Pacific');
    db.close();
  });

  it('default time slot windows match spec', async () => {
    const db = createTestDb();
    const service = createSettingsService(db);
    await service.bootstrapSettings(createTestConfig());

    expect(service.getSetting('morning_start')).toBe('05:00');
    expect(service.getSetting('morning_end')).toBe('10:59');
    expect(service.getSetting('afternoon_start')).toBe('15:00');
    expect(service.getSetting('afternoon_end')).toBe('18:29');
    expect(service.getSetting('bedtime_start')).toBe('18:30');
    expect(service.getSetting('bedtime_end')).toBe('21:30');
    db.close();
  });

  it('getPublicSettings excludes sensitive keys', async () => {
    const db = createTestDb();
    const service = createSettingsService(db);
    await service.bootstrapSettings(createTestConfig());

    const publicSettings = service.getPublicSettings();
    expect(publicSettings).not.toHaveProperty('admin_pin_hash');
    expect(publicSettings).toHaveProperty('timezone');
  });

  it('getAllSettings includes sensitive keys', async () => {
    const db = createTestDb();
    const service = createSettingsService(db);
    await service.bootstrapSettings(createTestConfig());

    const allSettings = service.getAllSettings();
    expect(allSettings).toHaveProperty('admin_pin_hash');
    expect(allSettings).toHaveProperty('timezone');
  });
});
