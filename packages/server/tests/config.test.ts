import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('throws when PUBLIC_ORIGIN is missing', () => {
    delete process.env.PUBLIC_ORIGIN;
    expect(() => loadConfig()).toThrow('PUBLIC_ORIGIN');
  });

  it('returns defaults when only PUBLIC_ORIGIN is set', () => {
    process.env.PUBLIC_ORIGIN = 'https://chores.example.com';
    delete process.env.PORT;
    delete process.env.DATA_DIR;
    delete process.env.TZ;
    delete process.env.INITIAL_ADMIN_PIN;
    delete process.env.ACTIVITY_RETENTION_DAYS_DEFAULT;
    delete process.env.IMAGE_GEN_API_KEY;

    const config = loadConfig();

    expect(config.publicOrigin).toBe('https://chores.example.com');
    expect(config.port).toBe(3000);
    expect(config.dataDir).toBe('./data');
    expect(config.timezone).toBe('America/New_York');
    expect(config.initialAdminPin).toBe('123456');
    expect(config.activityRetentionDays).toBe(365);
    expect(config.imageGenApiKey).toBeUndefined();
  });

  it('reads all env vars when set', () => {
    process.env.PUBLIC_ORIGIN = 'https://my-app.com';
    process.env.PORT = '8080';
    process.env.DATA_DIR = '/var/data';
    process.env.TZ = 'US/Pacific';
    process.env.INITIAL_ADMIN_PIN = '999999';
    process.env.ACTIVITY_RETENTION_DAYS_DEFAULT = '30';
    process.env.IMAGE_GEN_API_KEY = 'sk-test-key-123';

    const config = loadConfig();

    expect(config.publicOrigin).toBe('https://my-app.com');
    expect(config.port).toBe(8080);
    expect(config.dataDir).toBe('/var/data');
    expect(config.timezone).toBe('US/Pacific');
    expect(config.initialAdminPin).toBe('999999');
    expect(config.activityRetentionDays).toBe(30);
    expect(config.imageGenApiKey).toBe('sk-test-key-123');
  });

  it('logs warning when INITIAL_ADMIN_PIN is not set', () => {
    process.env.PUBLIC_ORIGIN = 'https://chores.example.com';
    delete process.env.INITIAL_ADMIN_PIN;

    loadConfig();

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('INITIAL_ADMIN_PIN not set'),
    );
  });

  it('does not warn when INITIAL_ADMIN_PIN is explicitly set', () => {
    process.env.PUBLIC_ORIGIN = 'https://chores.example.com';
    process.env.INITIAL_ADMIN_PIN = '654321';

    loadConfig();

    expect(console.warn).not.toHaveBeenCalled();
  });

  it('reads imageGenApiKey from IMAGE_GEN_API_KEY env var', () => {
    process.env.PUBLIC_ORIGIN = 'https://chores.example.com';
    process.env.IMAGE_GEN_API_KEY = 'my-api-key';

    const config = loadConfig();

    expect(config.imageGenApiKey).toBe('my-api-key');
  });
});
