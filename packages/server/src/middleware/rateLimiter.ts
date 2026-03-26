import type { Request, Response, NextFunction } from "express";
import {
  MAX_PIN_ATTEMPTS,
  RATE_LIMIT_WINDOW_MINUTES,
  COOLDOWN_ESCALATION_MINUTES,
} from "@chore-app/shared";

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

interface AttemptRecord {
  attempts: number[];
  cooldownUntil: number | null;
  cooldownLevel: number;
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  recordFailure: (ip: string) => void;
  _store: Map<string, AttemptRecord>;
}

export function createRateLimiter(): RateLimiterMiddleware {
  const store = new Map<string, AttemptRecord>();

  function getRecord(ip: string): AttemptRecord {
    let record = store.get(ip);
    if (!record) {
      record = { attempts: [], cooldownUntil: null, cooldownLevel: 0 };
      store.set(ip, record);
    }
    return record;
  }

  function pruneOldAttempts(record: AttemptRecord): void {
    const cutoff = Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    record.attempts = record.attempts.filter((t) => t > cutoff);
  }

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    for (const [ip, record] of store) {
      const hasCooldown = record.cooldownUntil !== null && record.cooldownUntil > now;
      const hasRecentAttempts = record.attempts.some((t) => t > now - windowMs);
      if (!hasCooldown && !hasRecentAttempts) store.delete(ip);
    }
  }, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  const middleware: RateLimiterMiddleware = ((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const record = getRecord(ip);

    if (record.cooldownUntil && Date.now() < record.cooldownUntil) {
      const retryAfter = Math.ceil((record.cooldownUntil - Date.now()) / 1000);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        },
      });
      return;
    }

    if (record.cooldownUntil && Date.now() >= record.cooldownUntil) {
      record.cooldownUntil = null;
      record.attempts = [];
    }

    pruneOldAttempts(record);

    if (record.attempts.length >= MAX_PIN_ATTEMPTS) {
      const level = Math.min(record.cooldownLevel, COOLDOWN_ESCALATION_MINUTES.length - 1);
      const cooldownMs = COOLDOWN_ESCALATION_MINUTES[level] * 60 * 1000;
      record.cooldownUntil = Date.now() + cooldownMs;
      record.cooldownLevel++;

      const retryAfter = Math.ceil(cooldownMs / 1000);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message: "Too many attempts. Please try again later.",
        },
      });
      return;
    }

    next();
  }) as RateLimiterMiddleware;

  middleware.recordFailure = (ip: string) => {
    const record = getRecord(ip);
    record.attempts.push(Date.now());
  };

  middleware._store = store;

  return middleware;
}
