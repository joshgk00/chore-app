import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createPointsService, type PointsService } from '../../src/services/pointsService.js';
import { seedRewardData, seedPointsLedger } from '../helpers/seed-rewards.js';

let db: Database.Database;
let service: PointsService;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRewardData(db);
  service = createPointsService(db);
});

afterEach(() => {
  db.close();
});

describe('pointsService', () => {
  describe('getBalance', () => {
    it('returns zeros with empty ledger', () => {
      const balance = service.getBalance();

      expect(balance).toEqual({ total: 0, reserved: 0, available: 0 });
    });

    it('after positive ledger entry shows correct total', () => {
      seedPointsLedger(db, 50);

      const balance = service.getBalance();

      expect(balance.total).toBe(50);
      expect(balance.available).toBe(50);
      expect(balance.reserved).toBe(0);
    });

    it('with pending reward request shows correct reserved and available', () => {
      seedPointsLedger(db, 100);

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).run(1, 'Extra Screen Time', 20, '2026-03-15', 'points-test-key');

      const balance = service.getBalance();

      expect(balance.total).toBe(100);
      expect(balance.reserved).toBe(20);
      expect(balance.available).toBe(80);
    });

    it('available = total - reserved with mixed ledger entries', () => {
      seedPointsLedger(db, 75);
      seedPointsLedger(db, 25);

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).run(1, 'Extra Screen Time', 20, '2026-03-15', 'key-1');

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'pending', ?)`,
      ).run(2, 'Movie Night Pick', 50, '2026-03-15', 'key-2');

      const balance = service.getBalance();

      expect(balance.total).toBe(100);
      expect(balance.reserved).toBe(70);
      expect(balance.available).toBe(30);
    });

    it('canceled requests are not counted as reserved', () => {
      seedPointsLedger(db, 100);

      db.prepare(
        `INSERT INTO reward_requests (reward_id, reward_name_snapshot, cost_snapshot, local_date, status, idempotency_key)
         VALUES (?, ?, ?, ?, 'canceled', ?)`,
      ).run(1, 'Extra Screen Time', 20, '2026-03-15', 'canceled-key');

      const balance = service.getBalance();

      expect(balance.reserved).toBe(0);
      expect(balance.available).toBe(100);
    });
  });

  describe('getLedger', () => {
    it('returns entries in descending date order', () => {
      seedPointsLedger(db, 10);
      seedPointsLedger(db, 20);
      seedPointsLedger(db, 30);

      const entries = service.getLedger({ limit: 10, offset: 0 });

      expect(entries).toHaveLength(3);
      expect(entries[0].amount).toBe(30);
      expect(entries[2].amount).toBe(10);
    });

    it('pagination with limit/offset works', () => {
      for (let i = 1; i <= 5; i++) {
        seedPointsLedger(db, i * 10);
      }

      const page1 = service.getLedger({ limit: 2, offset: 0 });
      const page2 = service.getLedger({ limit: 2, offset: 2 });

      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0].amount).toBe(50);
      expect(page2[0].amount).toBe(30);
    });

    it('returns correct fields', () => {
      seedPointsLedger(db, 42);

      const entries = service.getLedger({ limit: 10, offset: 0 });

      expect(entries).toHaveLength(1);
      expect(entries[0].entryType).toBe('manual');
      expect(entries[0].amount).toBe(42);
      expect(entries[0].note).toBe('Test points');
      expect(entries[0]).toHaveProperty('createdAt');
    });

    it('caps limit at 100', () => {
      for (let i = 0; i < 5; i++) {
        seedPointsLedger(db, i);
      }

      const entries = service.getLedger({ limit: 200, offset: 0 });

      expect(entries).toHaveLength(5);
    });
  });
});
