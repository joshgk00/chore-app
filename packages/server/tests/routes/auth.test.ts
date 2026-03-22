import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createTestDb, seedTestData, createTestConfig } from '../db-helpers.js';
import { createApp } from '../../src/app.js';

const testConfig = createTestConfig();

async function createTestApp() {
  const db = createTestDb();
  await seedTestData(db);
  const app = createApp(db, testConfig);
  return { db, app };
}

describe('auth routes', () => {
  it('POST /api/auth/verify with correct PIN returns 200 and sets cookie', async () => {
    const { db, app } = await createTestApp();

    const res = await request(app).post('/api/auth/verify').send({ pin: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.data.valid).toBe(true);
    expect(res.headers['set-cookie']).toBeDefined();
    db.close();
  });

  it('POST /api/auth/verify with wrong PIN returns 401', async () => {
    const { db, app } = await createTestApp();

    const res = await request(app).post('/api/auth/verify').send({ pin: '000000' });
    expect(res.status).toBe(401);
    db.close();
  });

  it('GET /api/auth/session with valid cookie returns 200 and refreshes the cookie', async () => {
    const { db, app } = await createTestApp();

    const loginRes = await request(app).post('/api/auth/verify').send({ pin: '123456' });
    const cookies = loginRes.headers['set-cookie'];

    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookies as string[]);
    expect(sessionRes.status).toBe(200);
    expect(sessionRes.body.data.valid).toBe(true);
    expect(sessionRes.headers['set-cookie']).toBeDefined();
    db.close();
  });

  it('GET /api/auth/session without cookie returns 401', async () => {
    const { db, app } = await createTestApp();

    const res = await request(app).get('/api/auth/session');
    expect(res.status).toBe(401);
    db.close();
  });

  it('POST /api/auth/lock clears the cookie without invalidating the session row', async () => {
    const { db, app } = await createTestApp();

    const loginRes = await request(app).post('/api/auth/verify').send({ pin: '123456' });
    const cookies = loginRes.headers['set-cookie'];

    const lockRes = await request(app)
      .post('/api/auth/lock')
      .set('Cookie', cookies as string[]);
    expect(lockRes.status).toBe(200);
    expect(lockRes.headers['set-cookie']).toBeDefined();

    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookies as string[]);
    expect(sessionRes.status).toBe(200);
    db.close();
  });

  it('POST /api/auth/logout invalidates the session', async () => {
    const { db, app } = await createTestApp();

    const loginRes = await request(app).post('/api/auth/verify').send({ pin: '123456' });
    const cookies = loginRes.headers['set-cookie'];

    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookies as string[]);

    const sessionRes = await request(app)
      .get('/api/auth/session')
      .set('Cookie', cookies as string[]);
    expect(sessionRes.status).toBe(401);
    db.close();
  });

  it('GET /api/admin/settings without session returns 401', async () => {
    const { db, app } = await createTestApp();

    const res = await request(app).get('/api/admin/settings');
    expect(res.status).toBe(401);
    db.close();
  });

  it('GET /api/admin/settings with valid session returns 200 and refreshes the cookie', async () => {
    const { db, app } = await createTestApp();

    const loginRes = await request(app).post('/api/auth/verify').send({ pin: '123456' });
    const cookies = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/admin/settings')
      .set('Cookie', cookies as string[]);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data).not.toHaveProperty('admin_pin_hash');
    expect(res.headers['set-cookie']).toBeDefined();
    db.close();
  });
});
