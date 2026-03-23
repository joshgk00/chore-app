import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData, createTestConfig } from '../db-helpers.js';
import { createApp } from '../../src/app.js';
import { seedRoutineData } from '../helpers/seed-routines.js';
import { seedChoreData } from '../helpers/seed-chores.js';

const testConfig = createTestConfig();
let db: Database.Database;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  seedChoreData(db);
});

afterEach(() => {
  vi.useRealTimers();
  db.close();
});

function buildApp() {
  return createApp(db, testConfig);
}

describe('child routes', () => {
  it('GET /api/routines returns routines without auth', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/routines');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data).toHaveLength(4);
    expect(res.body.data[0].name).toBe('Morning Routine');
    expect(res.body.data[0].items).toBeInstanceOf(Array);
  });

  it('GET /api/routines/:id returns routine without auth', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/routines/1');

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Morning Routine');
    expect(res.body.data.items).toHaveLength(2);
  });

  it('GET /api/routines/:id with non-numeric ID returns 422', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/routines/abc');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/routines/:id with nonexistent ID returns 404', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/routines/999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/routine-completions creates completion and returns 201', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({
        routineId: 3,
        checklistSnapshot: '[]',
        idempotencyKey: 'test-1',
        localDate: '2026-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('routineNameSnapshot');
    expect(res.body.data).toHaveProperty('pointsSnapshot');
    expect(res.body.data).toHaveProperty('status');
  });

  it('POST /api/routine-completions with duplicate idempotency key returns existing', async () => {
    const app = buildApp();
    const body = {
      routineId: 3,
      checklistSnapshot: '[]',
      idempotencyKey: 'dup-key-1',
      localDate: '2026-03-15',
    };

    const first = await request(app).post('/api/routine-completions').send(body);
    const second = await request(app).post('/api/routine-completions').send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
  });

  it('POST /api/routine-completions with missing fields returns 422', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/routine-completions').send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/routine-completions with invalid localDate format returns 422', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/routine-completions').send({
      routineId: 3,
      checklistSnapshot: '[]',
      idempotencyKey: 'test-format',
      localDate: '03/15/2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET /api/app/bootstrap returns routines and pendingRoutineCount', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/app/bootstrap');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('routines');
    expect(res.body.data.routines).toBeInstanceOf(Array);
    expect(res.body.data).toHaveProperty('pendingRoutineCount');
    expect(typeof res.body.data.pendingRoutineCount).toBe('number');
    expect(res.body.data.pendingRoutineCount).toBe(0);
  });

  it('GET /api/app/bootstrap filters routines by current time slot', async () => {
    // 7:00 AM ET on 2026-03-15 => morning slot (05:00-10:59)
    // UTC offset for ET in March (EDT): UTC-4, so 7:00 AM ET = 11:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-15T11:00:00Z'));

    const app = buildApp();
    const res = await request(app).get('/api/app/bootstrap');

    expect(res.status).toBe(200);
    const routineNames = res.body.data.routines.map((r: { name: string }) => r.name);

    expect(routineNames).toContain('Morning Routine');
    expect(routineNames).toContain('Quick Win');
    expect(routineNames).not.toContain('Afternoon Check');
    expect(routineNames).not.toContain('Bedtime Routine');
  });

  it('GET /api/app/bootstrap includes pendingChoreCount', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/app/bootstrap');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('pendingChoreCount');
    expect(typeof res.body.data.pendingChoreCount).toBe('number');
    expect(res.body.data.pendingChoreCount).toBe(0);
  });
});

describe('chore routes', () => {
  it('GET /api/chores returns chores without auth', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/chores');

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].name).toBe('Clean Kitchen');
    expect(res.body.data[0].tiers).toBeInstanceOf(Array);
  });

  it('POST /api/chore-logs creates chore log and returns 201', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({
        choreId: 1,
        tierId: 1,
        idempotencyKey: 'test-1',
        localDate: '2026-03-15',
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('choreNameSnapshot', 'Clean Kitchen');
    expect(res.body.data).toHaveProperty('tierNameSnapshot', 'Quick Clean');
    expect(res.body.data).toHaveProperty('pointsSnapshot', 3);
    expect(res.body.data).toHaveProperty('status', 'approved');
  });

  it('POST /api/chore-logs with duplicate idempotency key returns existing', async () => {
    const app = buildApp();
    const body = {
      choreId: 1,
      tierId: 1,
      idempotencyKey: 'dup-key-1',
      localDate: '2026-03-15',
    };

    const first = await request(app).post('/api/chore-logs').send(body);
    const second = await request(app).post('/api/chore-logs').send(body);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
  });

  it('POST /api/chore-logs with missing fields returns 422', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/chore-logs').send({});

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/chore-logs with invalid localDate format returns 422', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/chore-logs').send({
      choreId: 1,
      tierId: 1,
      idempotencyKey: 'test-format',
      localDate: '03/15/2026',
    });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/chore-logs/:id/cancel cancels pending log', async () => {
    const app = buildApp();

    const createRes = await request(app).post('/api/chore-logs').send({
      choreId: 2,
      tierId: 3,
      idempotencyKey: 'cancel-test',
      localDate: '2026-03-15',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.data.status).toBe('pending');

    const cancelRes = await request(app)
      .post(`/api/chore-logs/${createRes.body.data.id}/cancel`);

    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('canceled');
  });

  it('POST /api/chore-logs/:id/cancel with non-numeric ID returns 422', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/chore-logs/abc/cancel');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
