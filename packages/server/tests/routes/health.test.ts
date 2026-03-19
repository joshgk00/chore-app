import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestDb } from '../db-helpers.js';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config.js';

const testConfig: AppConfig = {
  port: 3000,
  publicOrigin: 'http://localhost:3000',
  dataDir: './data',
  timezone: 'America/New_York',
  initialAdminPin: '123456',
  activityRetentionDays: 365,
};

describe('health routes', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const db = createTestDb();
    const app = createApp(db, testConfig);

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
    db.close();
  });

  it('GET /api/nonexistent returns 404 with error envelope', async () => {
    const db = createTestDb();
    const app = createApp(db, testConfig);

    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('NOT_FOUND');
    db.close();
  });
});
