import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";
import type Database from "better-sqlite3";
import type { PushRole } from "@chore-app/shared";
import { MAX_PUSH_SUBSCRIPTIONS_PER_IP } from "@chore-app/shared";
import { RateLimitError } from "../lib/errors.js";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

export interface PushService {
  getVapidPublicKey(): string;
  subscribe(role: PushRole, endpoint: string, keys: { p256dh: string; auth: string }, ipAddress?: string): void;
  sendNotification(role: PushRole, payload: { title: string; body: string; data?: Record<string, unknown> }): void;
}

function isValidVapidKeys(keys: unknown): keys is VapidKeys {
  return (
    typeof keys === "object" &&
    keys !== null &&
    typeof (keys as VapidKeys).publicKey === "string" &&
    typeof (keys as VapidKeys).privateKey === "string" &&
    (keys as VapidKeys).publicKey.length > 0 &&
    (keys as VapidKeys).privateKey.length > 0
  );
}

function generateAndSaveKeys(keysPath: string): VapidKeys {
  console.log("Generating new VAPID keys...");
  const generated = webpush.generateVAPIDKeys();
  const keys: VapidKeys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
  };

  try {
    fs.writeFileSync(keysPath, JSON.stringify(keys, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error(`Failed to write VAPID keys to ${keysPath}:`, err);
    throw err;
  }

  return keys;
}

function initVapidKeys(dataDir: string, publicOrigin: string): VapidKeys {
  const secretsDir = path.join(dataDir, "secrets");
  const keysPath = path.join(secretsDir, "webpush.json");

  fs.mkdirSync(secretsDir, { recursive: true });

  let keys: VapidKeys;

  if (fs.existsSync(keysPath)) {
    console.log("Loading existing VAPID keys...");
    try {
      const raw = fs.readFileSync(keysPath, "utf-8");
      const parsed = JSON.parse(raw);

      if (isValidVapidKeys(parsed)) {
        keys = parsed;
      } else {
        console.error("VAPID keys file has invalid structure, regenerating...");
        keys = generateAndSaveKeys(keysPath);
      }
    } catch (err) {
      console.error("Failed to parse VAPID keys file, regenerating...", err);
      keys = generateAndSaveKeys(keysPath);
    }
  } else {
    keys = generateAndSaveKeys(keysPath);
  }

  let vapidSubject: string;
  if (publicOrigin.startsWith("https://")) {
    vapidSubject = publicOrigin;
  } else {
    let hostname: string;
    try {
      hostname = new URL(publicOrigin).hostname || "localhost";
    } catch {
      throw new Error(
        `Invalid PUBLIC_ORIGIN "${publicOrigin}". Expected an absolute URL such as "https://example.com".`,
      );
    }
    vapidSubject = `mailto:vapid@${hostname}`;
  }
  webpush.setVapidDetails(vapidSubject, keys.publicKey, keys.privateKey);

  return keys;
}

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  status: string;
}

export function createPushService(
  db: Database.Database,
  dataDir: string,
  publicOrigin: string,
): PushService {
  const vapidKeys = initVapidKeys(dataDir, publicOrigin);

  const upsertSubscriptionStmt = db.prepare(
    `INSERT INTO push_subscriptions (role, endpoint, p256dh, auth, ip_address, status, updated_at)
     VALUES (?, ?, ?, ?, ?, 'active', datetime('now'))
     ON CONFLICT(endpoint) DO UPDATE SET
       role = excluded.role,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       ip_address = excluded.ip_address,
       status = 'active',
       updated_at = datetime('now')`,
  );

  const countActiveByIpStmt = db.prepare(
    `SELECT COUNT(*) as count FROM push_subscriptions
     WHERE ip_address = ? AND status = 'active'`,
  );

  const existsByEndpointStmt = db.prepare(
    `SELECT id FROM push_subscriptions WHERE endpoint = ?`,
  );

  const selectActiveByRoleStmt = db.prepare(
    `SELECT id, endpoint, p256dh, auth, status
     FROM push_subscriptions
     WHERE role = ? AND status = 'active'`,
  );

  const markFailedStmt = db.prepare(
    `UPDATE push_subscriptions
     SET status = 'failed', last_failure_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  );

  const updateLastSuccessStmt = db.prepare(
    `UPDATE push_subscriptions
     SET last_success_at = datetime('now'), updated_at = datetime('now')
     WHERE id = ?`,
  );

  function getVapidPublicKey(): string {
    return vapidKeys.publicKey;
  }

  function subscribe(
    role: PushRole,
    endpoint: string,
    keys: { p256dh: string; auth: string },
    ipAddress?: string,
  ): void {
    // Enforce per-IP cap for new subscriptions (skip for re-subscriptions to existing endpoints)
    if (ipAddress) {
      const existingRow = existsByEndpointStmt.get(endpoint) as { id: number } | undefined;
      if (!existingRow) {
        const { count } = countActiveByIpStmt.get(ipAddress) as { count: number };
        if (count >= MAX_PUSH_SUBSCRIPTIONS_PER_IP) {
          throw new RateLimitError(
            `Too many subscriptions from this IP (max ${MAX_PUSH_SUBSCRIPTIONS_PER_IP})`,
          );
        }
      }
    }

    upsertSubscriptionStmt.run(role, endpoint, keys.p256dh, keys.auth, ipAddress ?? null);
  }

  function sendNotification(
    role: PushRole,
    payload: { title: string; body: string; data?: Record<string, unknown> },
  ): void {
    const subs = selectActiveByRoleStmt.all(role) as SubscriptionRow[];
    const jsonPayload = JSON.stringify(payload);

    for (const sub of subs) {
      const pushSub = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      webpush.sendNotification(pushSub, jsonPayload).then(
        () => {
          try { updateLastSuccessStmt.run(sub.id); } catch (err) {
            console.error(`Failed to update last_success_at for subscription ${sub.id}`, err);
          }
        },
        (err: unknown) => {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 410 || statusCode === 404) {
            try { markFailedStmt.run(sub.id); } catch (dbErr) {
              console.error(`Failed to mark subscription ${sub.id} as failed after HTTP ${statusCode}`, dbErr);
            }
          } else {
            // Transient failure — retry once
            webpush.sendNotification(pushSub, jsonPayload).then(
              () => {
                try { updateLastSuccessStmt.run(sub.id); } catch (retryErr) {
                  console.error(`Failed to update last_success_at for subscription ${sub.id} after retry`, retryErr);
                }
              },
              (err2: unknown) => {
                const statusCode2 = (err2 as { statusCode?: number })?.statusCode;
                if (statusCode2 === 410 || statusCode2 === 404) {
                  try { markFailedStmt.run(sub.id); } catch { /* best effort */ }
                }
                console.error(`Push delivery failed for subscription ${sub.id} after retry`);
              },
            );
          }
        },
      );
    }
  }

  return {
    getVapidPublicKey,
    subscribe,
    sendNotification,
  };
}
