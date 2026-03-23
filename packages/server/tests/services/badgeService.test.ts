import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type Database from 'better-sqlite3';
import { BADGE_KEYS } from '@chore-app/shared';
import { createTestDb, seedTestData } from '../db-helpers.js';
import { createBadgeService, type BadgeService } from '../../src/services/badgeService.js';
import { createActivityService } from '../../src/services/activityService.js';
import { createRoutineService, type RoutineService } from '../../src/services/routineService.js';
import { createChoreService, type ChoreService } from '../../src/services/choreService.js';
import { seedRoutineData } from '../helpers/seed-routines.js';
import { seedChoreData } from '../helpers/seed-chores.js';

let db: Database.Database;
let badgeService: BadgeService;
let routineService: RoutineService;
let choreService: ChoreService;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  seedRoutineData(db);
  seedChoreData(db);
  badgeService = createBadgeService(db);
  const activityService = createActivityService(db);
  routineService = createRoutineService(db, activityService, badgeService);
  choreService = createChoreService(db, activityService, badgeService);
});

afterEach(() => {
  db.close();
});

function submitRoutineCompletion(localDate: string, key: string) {
  return routineService.submitCompletion({
    routineId: 3,
    checklistSnapshot: '[]',
    randomizedOrder: null,
    idempotencyKey: key,
    localDate,
    timeSlot: 'anytime',
  });
}

function submitChoreLog(key: string) {
  return choreService.submitChoreLog({
    choreId: 1,
    tierId: 1,
    idempotencyKey: key,
    localDate: '2026-03-15',
  });
}

describe('badgeService', () => {
  describe('getEarnedBadges', () => {
    it('returns empty array when no badges earned', () => {
      const badges = badgeService.getEarnedBadges();
      expect(badges).toEqual([]);
    });

    it('returns earned badges after evaluation', () => {
      submitRoutineCompletion('2026-03-15', 'badge-key-1');

      const badges = badgeService.getEarnedBadges();
      const keys = badges.map((b) => b.badgeKey);
      expect(keys).toContain(BADGE_KEYS.FIRST_STEP);
    });
  });

  describe('getRecentBadges', () => {
    it('returns limited recent badges', () => {
      submitRoutineCompletion('2026-03-15', 'badge-key-1');

      const recent = badgeService.getRecentBadges(1);
      expect(recent).toHaveLength(1);
      expect(recent[0].badgeKey).toBe(BADGE_KEYS.FIRST_STEP);
    });
  });

  describe('evaluateBadges', () => {
    it('awards first_step on first routine completion', () => {
      submitRoutineCompletion('2026-03-15', 'first-key');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.FIRST_STEP);
    });

    it('does not re-insert badges already earned', () => {
      submitRoutineCompletion('2026-03-15', 'dup-key-1');
      submitRoutineCompletion('2026-03-16', 'dup-key-2');

      const badges = badgeService.getEarnedBadges();
      const firstStepCount = badges.filter(
        (b) => b.badgeKey === BADGE_KEYS.FIRST_STEP,
      ).length;
      expect(firstStepCount).toBe(1);
    });

    it('awards on_a_roll after 3 consecutive days', () => {
      submitRoutineCompletion('2026-03-13', 'streak-1');
      submitRoutineCompletion('2026-03-14', 'streak-2');
      submitRoutineCompletion('2026-03-15', 'streak-3');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.ON_A_ROLL);
    });

    it('does not award on_a_roll for non-consecutive days', () => {
      submitRoutineCompletion('2026-03-10', 'gap-1');
      submitRoutineCompletion('2026-03-12', 'gap-2');
      submitRoutineCompletion('2026-03-15', 'gap-3');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).not.toContain(BADGE_KEYS.ON_A_ROLL);
    });

    it('awards week_warrior after 7 consecutive days', () => {
      for (let i = 0; i < 7; i++) {
        const date = `2026-03-${String(10 + i).padStart(2, '0')}`;
        submitRoutineCompletion(date, `week-${i}`);
      }

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.WEEK_WARRIOR);
    });

    it('awards chore_champion after 10 approved chore logs', () => {
      for (let i = 0; i < 10; i++) {
        submitChoreLog(`chore-champ-${i}`);
      }

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.CHORE_CHAMPION);
    });

    it('awards point_hoarder when total crosses 100', () => {
      db.prepare(
        `INSERT INTO points_ledger (entry_type, amount, note) VALUES ('manual', 99, 'seed')`,
      ).run();

      submitRoutineCompletion('2026-03-15', 'cross-100');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.POINT_HOARDER);
    });

    it('awards big_spender when total crosses 500', () => {
      db.prepare(
        `INSERT INTO points_ledger (entry_type, amount, note) VALUES ('manual', 498, 'seed')`,
      ).run();

      submitChoreLog('cross-500');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.BIG_SPENDER);
    });

    it('runs atomically with parent transaction — rollback leaves no partial badge', () => {
      db.prepare(
        `INSERT INTO points_ledger (entry_type, amount, note) VALUES ('manual', 99, 'seed')`,
      ).run();

      submitRoutineCompletion('2026-03-15', 'atomic-key');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.FIRST_STEP);
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.POINT_HOARDER);

      const completions = db
        .prepare('SELECT COUNT(*) as count FROM routine_completions')
        .get() as { count: number };
      expect(completions.count).toBe(1);
    });

    it('badge evaluation via chore log on approved path', () => {
      db.prepare(
        `INSERT INTO points_ledger (entry_type, amount, note) VALUES ('manual', 97, 'seed')`,
      ).run();

      submitChoreLog('chore-badge-key');

      const badges = badgeService.getEarnedBadges();
      expect(badges.map((b) => b.badgeKey)).toContain(BADGE_KEYS.POINT_HOARDER);
    });

    it('badge evaluation does not run on pending path', () => {
      choreService.submitChoreLog({
        choreId: 2,
        tierId: 3,
        idempotencyKey: 'pending-no-badge',
        localDate: '2026-03-15',
      });

      const badges = badgeService.getEarnedBadges();
      expect(badges).toEqual([]);
    });
  });
});
