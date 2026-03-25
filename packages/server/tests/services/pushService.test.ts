import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestDb, seedTestData } from "../db-helpers.js";
import webpush from "web-push";
import { createPushService } from "../../src/services/pushService.js";
import type { PushService } from "../../src/services/pushService.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type Database from "better-sqlite3";

let db: Database.Database;
let pushService: PushService;
let tmpDir: string;

beforeEach(async () => {
  db = createTestDb();
  await seedTestData(db);
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "push-test-"));
  pushService = createPushService(db, tmpDir, "http://localhost:3000");
  vi.clearAllMocks();
});

describe("pushService", () => {
  describe("getVapidPublicKey", () => {
    it("returns the VAPID public key", () => {
      const key = pushService.getVapidPublicKey();
      expect(key).toBe("BN_test_public_key_for_testing_push_notifications");
    });
  });

  describe("subscribe", () => {
    it("creates a new subscription row", () => {
      pushService.subscribe("child", "https://push.example.com/sub1", {
        p256dh: "test-p256dh",
        auth: "test-auth",
      });

      const row = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/sub1") as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.role).toBe("child");
      expect(row.p256dh).toBe("test-p256dh");
      expect(row.auth).toBe("test-auth");
      expect(row.status).toBe("active");
    });

    it("creates admin subscription", () => {
      pushService.subscribe("admin", "https://push.example.com/admin1", {
        p256dh: "admin-p256dh",
        auth: "admin-auth",
      });

      const row = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/admin1") as Record<string, unknown>;
      expect(row).toBeDefined();
      expect(row.role).toBe("admin");
    });

    it("updates existing subscription with same endpoint (dedup)", () => {
      pushService.subscribe("child", "https://push.example.com/sub1", {
        p256dh: "old-p256dh",
        auth: "old-auth",
      });

      pushService.subscribe("admin", "https://push.example.com/sub1", {
        p256dh: "new-p256dh",
        auth: "new-auth",
      });

      const rows = db.prepare("SELECT * FROM push_subscriptions WHERE endpoint = ?")
        .all("https://push.example.com/sub1");
      expect(rows).toHaveLength(1);

      const row = rows[0] as Record<string, unknown>;
      expect(row.role).toBe("admin");
      expect(row.p256dh).toBe("new-p256dh");
      expect(row.auth).toBe("new-auth");
      expect(row.status).toBe("active");
    });

    it("re-subscribing with previously failed endpoint reactivates it", () => {
      pushService.subscribe("child", "https://push.example.com/sub1", {
        p256dh: "test-p256dh",
        auth: "test-auth",
      });

      // Manually mark as failed
      db.prepare("UPDATE push_subscriptions SET status = 'failed' WHERE endpoint = ?")
        .run("https://push.example.com/sub1");

      const failed = db.prepare("SELECT status FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/sub1") as Record<string, unknown>;
      expect(failed.status).toBe("failed");

      // Re-subscribe
      pushService.subscribe("child", "https://push.example.com/sub1", {
        p256dh: "new-p256dh",
        auth: "new-auth",
      });

      const reactivated = db.prepare("SELECT status FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/sub1") as Record<string, unknown>;
      expect(reactivated.status).toBe("active");
    });
  });

  describe("sendNotification", () => {
    it("sends to all active subscriptions for the role", () => {
      pushService.subscribe("child", "https://push.example.com/c1", { p256dh: "p1", auth: "a1" });
      pushService.subscribe("child", "https://push.example.com/c2", { p256dh: "p2", auth: "a2" });
      pushService.subscribe("admin", "https://push.example.com/a1", { p256dh: "p3", auth: "a3" });

      vi.mocked(webpush.sendNotification).mockResolvedValue({} as webpush.SendResult);

      pushService.sendNotification("child", { title: "Test", body: "Hello" });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    it("skips subscriptions with failed status", () => {
      pushService.subscribe("child", "https://push.example.com/c1", { p256dh: "p1", auth: "a1" });
      pushService.subscribe("child", "https://push.example.com/c2", { p256dh: "p2", auth: "a2" });

      // Mark one as failed
      db.prepare("UPDATE push_subscriptions SET status = 'failed' WHERE endpoint = ?")
        .run("https://push.example.com/c1");

      vi.mocked(webpush.sendNotification).mockResolvedValue({} as webpush.SendResult);

      pushService.sendNotification("child", { title: "Test", body: "Hello" });

      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    });

    it("marks subscription as failed on 410 Gone", async () => {
      pushService.subscribe("child", "https://push.example.com/c1", { p256dh: "p1", auth: "a1" });

      const error = new Error("Gone") as Error & { statusCode: number };
      error.statusCode = 410;
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      pushService.sendNotification("child", { title: "Test", body: "Hello" });

      // Wait for the async promise chain to resolve
      await vi.waitFor(() => {
        const row = db.prepare("SELECT status FROM push_subscriptions WHERE endpoint = ?")
          .get("https://push.example.com/c1") as Record<string, unknown>;
        expect(row.status).toBe("failed");
      });
    });

    it("marks subscription as failed on 404", async () => {
      pushService.subscribe("child", "https://push.example.com/c1", { p256dh: "p1", auth: "a1" });

      const error = new Error("Not Found") as Error & { statusCode: number };
      error.statusCode = 404;
      vi.mocked(webpush.sendNotification).mockRejectedValue(error);

      pushService.sendNotification("child", { title: "Test", body: "Hello" });

      await vi.waitFor(() => {
        const row = db.prepare("SELECT status FROM push_subscriptions WHERE endpoint = ?")
          .get("https://push.example.com/c1") as Record<string, unknown>;
        expect(row.status).toBe("failed");
      });
    });

    it("retries once on transient failure", async () => {
      pushService.subscribe("child", "https://push.example.com/c1", { p256dh: "p1", auth: "a1" });

      const error = new Error("Service Unavailable") as Error & { statusCode: number };
      error.statusCode = 503;
      vi.mocked(webpush.sendNotification)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({} as webpush.SendResult);

      pushService.sendNotification("child", { title: "Test", body: "Hello" });

      await vi.waitFor(() => {
        expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
      });

      // Should still be active after transient failure
      const row = db.prepare("SELECT status FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/c1") as Record<string, unknown>;
      expect(row.status).toBe("active");
    });

    it("does not throw errors (fire-and-forget)", () => {
      pushService.subscribe("child", "https://push.example.com/c1", { p256dh: "p1", auth: "a1" });

      vi.mocked(webpush.sendNotification).mockRejectedValue(new Error("Network error"));

      // Should not throw
      expect(() => {
        pushService.sendNotification("child", { title: "Test", body: "Hello" });
      }).not.toThrow();
    });

    it("sends JSON payload with title, body, and data", () => {
      pushService.subscribe("admin", "https://push.example.com/a1", { p256dh: "p1", auth: "a1" });

      vi.mocked(webpush.sendNotification).mockResolvedValue({} as webpush.SendResult);

      pushService.sendNotification("admin", {
        title: "Review needed",
        body: "Routine needs approval",
        data: { type: "routine_completion", id: 42 },
      });

      expect(webpush.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: "https://push.example.com/a1",
          keys: { p256dh: "p1", auth: "a1" },
        }),
        JSON.stringify({
          title: "Review needed",
          body: "Routine needs approval",
          data: { type: "routine_completion", id: 42 },
        }),
      );
    });
  });
});
