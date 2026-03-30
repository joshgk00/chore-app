import { describe, it, expect, beforeEach } from "vitest";
import type Database from "better-sqlite3";
import { createTestDb, seedTestData } from "../db-helpers.js";
import { createSystemHealthService } from "../../src/services/systemHealthService.js";
import type { SystemHealthService } from "../../src/services/systemHealthService.js";

function insertActivityEvent(
  db: Database.Database,
  eventType: string,
  summary: string,
  createdAt?: string,
): void {
  db.prepare(
    `INSERT INTO activity_events (event_type, summary, created_at)
     VALUES (?, ?, COALESCE(?, datetime('now')))`,
  ).run(eventType, summary, createdAt ?? null);
}

function insertPushSubscription(
  db: Database.Database,
  status: string,
): void {
  const endpoint = `https://push.example.com/${Math.random()}`;
  db.prepare(
    `INSERT INTO push_subscriptions (role, endpoint, p256dh, auth, status)
     VALUES (?, ?, ?, ?, ?)`,
  ).run("admin", endpoint, "key-p256dh", "key-auth", status);
}

describe("systemHealthService", () => {
  let db: Database.Database;
  let service: SystemHealthService;

  beforeEach(async () => {
    db = createTestDb();
    await seedTestData(db);
    service = createSystemHealthService(db);
  });

  describe("databaseSizeBytes", () => {
    it("returns a positive number", () => {
      const result = service.getSystemHealth();
      expect(result.databaseSizeBytes).toBeGreaterThan(0);
    });
  });

  describe("activityEventCount", () => {
    it("returns zero when no events exist", () => {
      const result = service.getSystemHealth();
      expect(result.activityEventCount).toBe(0);
    });

    it("counts all activity events", () => {
      insertActivityEvent(db, "routine_completed", "Morning routine done");
      insertActivityEvent(db, "chore_logged", "Took out trash");
      insertActivityEvent(db, "backup_exported", "Backup created");

      const result = service.getSystemHealth();
      expect(result.activityEventCount).toBe(3);
    });
  });

  describe("lastBackupAt", () => {
    it("returns null when no backups exist", () => {
      const result = service.getSystemHealth();
      expect(result.lastBackupAt).toBeNull();
    });

    it("returns the most recent backup timestamp", () => {
      insertActivityEvent(
        db,
        "backup_exported",
        "Old backup",
        "2026-03-01 10:00:00",
      );
      insertActivityEvent(
        db,
        "backup_exported",
        "New backup",
        "2026-03-15 14:30:00",
      );

      const result = service.getSystemHealth();
      expect(result.lastBackupAt).toBe("2026-03-15 14:30:00");
    });

    it("ignores non-backup events", () => {
      insertActivityEvent(db, "routine_completed", "Not a backup");

      const result = service.getSystemHealth();
      expect(result.lastBackupAt).toBeNull();
    });
  });

  describe("pushSubscriptions", () => {
    it("returns zeros when no subscriptions exist", () => {
      const result = service.getSystemHealth();
      expect(result.pushSubscriptions).toEqual({
        active: 0,
        expired: 0,
        failed: 0,
      });
    });

    it("counts subscriptions by status", () => {
      insertPushSubscription(db, "active");
      insertPushSubscription(db, "active");
      insertPushSubscription(db, "expired");
      insertPushSubscription(db, "failed");
      insertPushSubscription(db, "failed");
      insertPushSubscription(db, "failed");

      const result = service.getSystemHealth();
      expect(result.pushSubscriptions).toEqual({
        active: 2,
        expired: 1,
        failed: 3,
      });
    });
  });

  describe("combined results", () => {
    it("returns all fields together", () => {
      insertActivityEvent(
        db,
        "backup_exported",
        "Backup",
        "2026-03-20 08:00:00",
      );
      insertPushSubscription(db, "active");

      const result = service.getSystemHealth();
      expect(result).toEqual({
        databaseSizeBytes: expect.any(Number),
        activityEventCount: 1,
        lastBackupAt: "2026-03-20 08:00:00",
        pushSubscriptions: { active: 1, expired: 0, failed: 0 },
      });
    });
  });
});
