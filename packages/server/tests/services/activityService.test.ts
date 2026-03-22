import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { createTestDb } from '../db-helpers.js';
import { createActivityService } from '../../src/services/activityService.js';

let db: Database.Database;

beforeEach(() => {
  db = createTestDb();
});

describe('activityService', () => {
  describe('recordActivity', () => {
    it('inserts a minimal event with only eventType', () => {
      const service = createActivityService(db);

      service.recordActivity({ eventType: 'test_event' });

      const row = db.prepare('SELECT * FROM activity_events').get() as {
        event_type: string;
        entity_type: null;
        entity_id: null;
        summary: null;
        metadata_json: null;
      };
      expect(row.event_type).toBe('test_event');
      expect(row.entity_type).toBeNull();
      expect(row.entity_id).toBeNull();
      expect(row.summary).toBeNull();
      expect(row.metadata_json).toBeNull();
    });

    it('inserts a full event with all fields', () => {
      const service = createActivityService(db);

      service.recordActivity({
        eventType: 'routine_submitted',
        entityType: 'routine',
        entityId: 42,
        summary: 'Morning routine completed',
        metadata: { points: 10, itemCount: 3 },
      });

      const row = db.prepare('SELECT * FROM activity_events').get() as {
        event_type: string;
        entity_type: string;
        entity_id: number;
        summary: string;
        metadata_json: string;
      };
      expect(row.event_type).toBe('routine_submitted');
      expect(row.entity_type).toBe('routine');
      expect(row.entity_id).toBe(42);
      expect(row.summary).toBe('Morning routine completed');
      expect(JSON.parse(row.metadata_json)).toEqual({ points: 10, itemCount: 3 });
    });

    it('inserts multiple events independently', () => {
      const service = createActivityService(db);

      service.recordActivity({ eventType: 'event_one' });
      service.recordActivity({ eventType: 'event_two' });

      const count = db
        .prepare('SELECT COUNT(*) as n FROM activity_events')
        .get() as { n: number };
      expect(count.n).toBe(2);
    });
  });

  describe('getRecentActivity', () => {
    it('returns empty array when no events exist', () => {
      const service = createActivityService(db);
      expect(service.getRecentActivity()).toEqual([]);
    });

    it('returns events in descending creation order', () => {
      const service = createActivityService(db);

      service.recordActivity({ eventType: 'first' });
      service.recordActivity({ eventType: 'second' });
      service.recordActivity({ eventType: 'third' });

      const events = service.getRecentActivity();
      expect(events[0].eventType).toBe('third');
      expect(events[1].eventType).toBe('second');
      expect(events[2].eventType).toBe('first');
    });

    it('respects the limit parameter', () => {
      const service = createActivityService(db);

      for (let i = 0; i < 5; i++) {
        service.recordActivity({ eventType: `event_${i}` });
      }

      const events = service.getRecentActivity(3);
      expect(events).toHaveLength(3);
    });

    it('defaults to 20 when no limit provided', () => {
      const service = createActivityService(db);

      for (let i = 0; i < 25; i++) {
        service.recordActivity({ eventType: `event_${i}` });
      }

      expect(service.getRecentActivity()).toHaveLength(20);
    });

    it('maps metadata_json back to an object', () => {
      const service = createActivityService(db);

      service.recordActivity({
        eventType: 'chore_logged',
        metadata: { tier: 'gold', points: 50 },
      });

      const [event] = service.getRecentActivity();
      expect(event.metadata).toEqual({ tier: 'gold', points: 50 });
    });

    it('returns undefined for optional fields when null in DB', () => {
      const service = createActivityService(db);

      service.recordActivity({ eventType: 'bare_event' });

      const [event] = service.getRecentActivity();
      expect(event.entityType).toBeUndefined();
      expect(event.entityId).toBeUndefined();
      expect(event.summary).toBeUndefined();
      expect(event.metadata).toBeUndefined();
    });

    it('includes createdAt timestamp', () => {
      const service = createActivityService(db);

      service.recordActivity({ eventType: 'timestamped' });

      const [event] = service.getRecentActivity();
      expect(event.createdAt).toBeTruthy();
    });
  });
});
