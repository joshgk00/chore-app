import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { createTestDb, createTestConfig } from '../db-helpers.js';
import { createApp } from '../../src/app.js';
import type Database from 'better-sqlite3';

const MANIFEST_FIXTURE = {
  name: 'Chores',
  short_name: 'Chores',
  display: 'standalone',
  start_url: '/',
  background_color: '#ffffff',
  theme_color: '#f59e0b',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  ],
};

const testConfig = createTestConfig();
let db: Database.Database;

function setupManifestFixture() {
  const clientDist = path.resolve(__dirname, '../../../client/dist');
  fs.mkdirSync(clientDist, { recursive: true });
  fs.writeFileSync(
    path.join(clientDist, 'manifest.json'),
    JSON.stringify(MANIFEST_FIXTURE),
  );
  // SPA fallback needs an index.html
  fs.writeFileSync(path.join(clientDist, 'index.html'), '<html></html>');
}

beforeAll(() => {
  setupManifestFixture();
  db = createTestDb();
});

afterAll(() => {
  db.close();
  const clientDist = path.resolve(__dirname, '../../../client/dist');
  fs.rmSync(path.join(clientDist, 'manifest.json'), { force: true });
  fs.rmSync(path.join(clientDist, 'index.html'), { force: true });
});

describe('GET /manifest.json', () => {
  it('returns the manifest with default start_url when no query param', async () => {
    const app = createApp(db, testConfig);

    const res = await request(app).get('/manifest.json');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Chores');
    expect(res.body.start_url).toBe('/');
  });

  it('overrides start_url when a valid value is provided', async () => {
    const app = createApp(db, testConfig);

    const res = await request(app).get('/manifest.json?start_url=/admin');
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe('/admin');
    expect(res.body.name).toBe('Chores');
  });

  it('accepts /today as a valid start_url', async () => {
    const app = createApp(db, testConfig);

    const res = await request(app).get('/manifest.json?start_url=/today');
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe('/today');
  });

  it('ignores invalid start_url values and falls back to default', async () => {
    const app = createApp(db, testConfig);

    const res = await request(app).get('/manifest.json?start_url=/evil');
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe('/');
  });

  it('ignores start_url with external URLs', async () => {
    const app = createApp(db, testConfig);

    const res = await request(app).get(
      '/manifest.json?start_url=https://evil.com',
    );
    expect(res.status).toBe(200);
    expect(res.body.start_url).toBe('/');
  });

  it('preserves all other manifest fields', async () => {
    const app = createApp(db, testConfig);

    const res = await request(app).get('/manifest.json?start_url=/admin');
    expect(res.body.display).toBe('standalone');
    expect(res.body.theme_color).toBe('#f59e0b');
    expect(res.body.icons).toHaveLength(1);
  });
});
