import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData, createTestConfig } from '../db-helpers.js';
import { createApp } from '../../src/app.js';
import { seedRoutineData } from '../helpers/seed-routines.js';
import { seedChoreData } from '../helpers/seed-chores.js';
import { seedRewardData, seedPointsLedger } from '../helpers/seed-rewards.js';

const testConfig = createTestConfig();
let db: Database.Database;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  seedChoreData(db);
  seedRewardData(db);
});

afterEach(() => {
  db.close();
});

function buildApp() {
  return createApp(db, testConfig);
}

const validBody = {
  routineId: 3,
  checklistSnapshot: JSON.stringify([{ itemId: 5, isChecked: true }]),
  randomizedOrder: null,
  idempotencyKey: 'test-key-123',
  localDate: '2026-03-15',
};

describe('submission routes', () => {
  it('valid submission returns 201 with completion data', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.routineId).toBe(3);
    expect(res.body.data.routineNameSnapshot).toBe('Quick Win');
    expect(res.body.data.pointsSnapshot).toBe(1);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.idempotencyKey).toBe('test-key-123');
  });

  it('duplicate idempotencyKey returns existing record', async () => {
    const app = buildApp();
    const first = await request(app)
      .post('/api/routine-completions')
      .send(validBody);
    const second = await request(app)
      .post('/api/routine-completions')
      .send(validBody);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.data.id).toBe(second.body.data.id);
  });

  it('missing routineId returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, routineId: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing checklistSnapshot returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, checklistSnapshot: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalid checklistSnapshot (not JSON) returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, checklistSnapshot: 'not-json{' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('valid JSON');
  });

  it('missing idempotencyKey returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, idempotencyKey: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing localDate returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, localDate: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalid localDate format returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, localDate: '03/15/2026' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('YYYY-MM-DD');
  });

  it('idempotencyKey exceeding 255 chars returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, idempotencyKey: 'k'.repeat(256) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('maximum length');
  });

  it('checklistSnapshot exceeding 10000 chars returns 422', async () => {
    const app = buildApp();
    const longSnapshot = JSON.stringify([{ itemId: 1, isChecked: true, data: 'x'.repeat(10000) }]);
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, checklistSnapshot: longSnapshot });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('maximum length');
  });

  it('randomizedOrder wrong type (number) returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, randomizedOrder: 42 });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('randomizedOrder');
  });

  it('archived routine returns 409', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/routine-completions')
      .send({ ...validBody, routineId: 4, idempotencyKey: 'archived-test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

const validChoreBody = {
  choreId: 1,
  tierId: 1,
  idempotencyKey: 'chore-test-key-1',
  localDate: '2026-03-15',
};

describe('chore-log submission routes', () => {
  it('valid chore log returns 201', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send(validChoreBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.choreNameSnapshot).toBe('Clean Kitchen');
    expect(res.body.data.tierNameSnapshot).toBe('Quick Clean');
    expect(res.body.data.pointsSnapshot).toBe(3);
    expect(res.body.data.status).toBe('approved');
  });

  it('missing choreId returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, choreId: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing tierId returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, tierId: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing idempotencyKey returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, idempotencyKey: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing localDate returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, localDate: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalid localDate format returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, localDate: '03/15/2026' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('idempotencyKey exceeding 255 chars returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, idempotencyKey: 'k'.repeat(256) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('archived chore returns 409', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/chore-logs')
      .send({ ...validChoreBody, choreId: 3, tierId: 4, idempotencyKey: 'archived-test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('cancel approved log returns 409', async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post('/api/chore-logs')
      .send(validChoreBody);
    expect(createRes.body.data.status).toBe('approved');

    const cancelRes = await request(app)
      .post(`/api/chore-logs/${createRes.body.data.id}/cancel`);

    expect(cancelRes.status).toBe(409);
    expect(cancelRes.body.error.code).toBe('CONFLICT');
  });

  it('cancel nonexistent log returns 404', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/chore-logs/999/cancel');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/chore-logs/:id', () => {
  it('returns an existing chore log', async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post('/api/chore-logs')
      .send(validChoreBody);
    const logId = createRes.body.data.id;

    const res = await request(app).get(`/api/chore-logs/${logId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(logId);
    expect(res.body.data.choreNameSnapshot).toBe('Clean Kitchen');
    expect(res.body.data.status).toBe('approved');
  });

  it('returns pending status for approval-required chore', async () => {
    const app = buildApp();
    const createRes = await request(app)
      .post('/api/chore-logs')
      .send({ choreId: 2, tierId: 3, idempotencyKey: 'pending-test', localDate: '2026-03-15' });

    const logId = createRes.body.data.id;
    const res = await request(app).get(`/api/chore-logs/${logId}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('pending');
  });

  it('nonexistent log returns 404', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/chore-logs/999');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('non-numeric ID returns 422', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/chore-logs/abc');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

const validRewardBody = {
  rewardId: 1,
  idempotencyKey: 'reward-sub-key-1',
  localDate: '2026-03-15',
};

describe('reward-request submission routes', () => {
  it('valid reward request returns 201', async () => {
    seedPointsLedger(db, 100);

    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send(validRewardBody);

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data.rewardNameSnapshot).toBe('Extra Screen Time');
    expect(res.body.data.costSnapshot).toBe(20);
    expect(res.body.data.status).toBe('pending');
  });

  it('missing rewardId returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send({ ...validRewardBody, rewardId: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing idempotencyKey returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send({ ...validRewardBody, idempotencyKey: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('missing localDate returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send({ ...validRewardBody, localDate: undefined });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('invalid localDate format returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send({ ...validRewardBody, localDate: '03/15/2026' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('idempotencyKey exceeding 255 chars returns 422', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send({ ...validRewardBody, idempotencyKey: 'k'.repeat(256) });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('archived reward returns 409', async () => {
    seedPointsLedger(db, 100);

    const app = buildApp();
    const res = await request(app)
      .post('/api/reward-requests')
      .send({ ...validRewardBody, rewardId: 3, idempotencyKey: 'archived-test' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('cancel non-numeric ID returns 422', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/reward-requests/abc/cancel');

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('cancel nonexistent request returns 404', async () => {
    const app = buildApp();
    const res = await request(app).post('/api/reward-requests/999/cancel');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
