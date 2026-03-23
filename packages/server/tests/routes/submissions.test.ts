import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData, createTestConfig } from '../db-helpers.js';
import { createApp } from '../../src/app.js';
import { seedRoutineData } from '../helpers/seed-routines.js';

const testConfig = createTestConfig();
let db: Database.Database;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
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
