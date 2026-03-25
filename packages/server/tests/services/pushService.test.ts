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

    it("skips IP cap check when ipAddress is omitted", () => {
      const ip = "10.0.0.99";
      for (let i = 0; i < 10; i++) {
        pushService.subscribe("child", `https://push.example.com/prefill${i}`, {
          p256dh: `p${i}`,
          auth: `a${i}`,
        }, ip);
      }

      // Without ipAddress, cap check is bypassed
      expect(() => {
        pushService.subscribe("child", "https://push.example.com/no-ip", {
          p256dh: "px",
          auth: "ax",
        });
      }).not.toThrow();
    });

    it("stores ip_address when provided", () => {
      pushService.subscribe("child", "https://push.example.com/sub1", {
        p256dh: "test-p256dh",
        auth: "test-auth",
      }, "192.168.1.1");

      const row = db.prepare("SELECT ip_address FROM push_subscriptions WHERE endpoint = ?")
        .get("https://push.example.com/sub1") as Record<string, unknown>;
      expect(row.ip_address).toBe("192.168.1.1");
    });

    it("rejects when IP exceeds subscription cap", () => {
      const ip = "10.0.0.1";
      for (let i = 0; i < 10; i++) {
        pushService.subscribe("child", `https://push.example.com/sub${i}`, {
          p256dh: `p${i}`,
          auth: `a${i}`,
        }, ip);
      }

      expect(() => {
        pushService.subscribe("child", "https://push.example.com/over-limit", {
          p256dh: "px",
          auth: "ax",
        }, ip);
      }).toThrow("Too many subscriptions from this IP");
    });

    it("allows re-subscription to existing endpoint even at cap", () => {
      const ip = "10.0.0.2";
      for (let i = 0; i < 10; i++) {
        pushService.subscribe("child", `https://push.example.com/cap${i}`, {
          p256dh: `p${i}`,
          auth: `a${i}`,
        }, ip);
      }

      // Re-subscribing to an existing endpoint should succeed
      expect(() => {
        pushService.subscribe("child", "https://push.example.com/cap5", {
          p256dh: "updated-p",
          auth: "updated-a",
        }, ip);
      }).not.toThrow();
    });

    it("allows subscription from different IP even if another IP is at cap", () => {
      const ip1 = "10.0.0.3";
      const ip2 = "10.0.0.4";
      for (let i = 0; i < 10; i++) {
        pushService.subscribe("child", `https://push.example.com/ip1-${i}`, {
          p256dh: `p${i}`,
          auth: `a${i}`,
        }, ip1);
      }

      expect(() => {
        pushService.subscribe("child", "https://push.example.com/ip2-new", {
          p256dh: "px",
          auth: "ax",
        }, ip2);
      }).not.toThrow();
    });

    it("does not count failed subscriptions toward IP cap", () => {
      const ip = "10.0.0.5";
      for (let i = 0; i < 10; i++) {
        pushService.subscribe("child", `https://push.example.com/fail${i}`, {
          p256dh: `p${i}`,
          auth: `a${i}`,
        }, ip);
      }

      // Mark 5 as failed
      for (let i = 0; i < 5; i++) {
        db.prepare("UPDATE push_subscriptions SET status = 'failed' WHERE endpoint = ?")
          .run(`https://push.example.com/fail${i}`);
      }

      // Should now allow new subscriptions since only 5 are active
      expect(() => {
        pushService.subscribe("child", "https://push.example.com/after-fail", {
          p256dh: "px",
          auth: "ax",
        }, ip);
      }).not.toThrow();
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
