import type { Request, Response, NextFunction } from "express";
import {
  MAX_PIN_ATTEMPTS,
  RATE_LIMIT_WINDOW_MINUTES,
  COOLDOWN_ESCALATION_MINUTES,
} from "@chore-app/shared";

interface AttemptRecord {
  attempts: number[];
  cooldownUntil: number | null;
  cooldownLevel: number;
}

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

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  recordFailure: (ip: string) => void;
  _store: Map<string, AttemptRecord>;
}

export function createRateLimiter(): RateLimiterMiddleware {
  const middleware: RateLimiterMiddleware = ((req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown";
    const record = getRecord(ip);

    // Check if in cooldown
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

    // Reset cooldown if expired
    if (record.cooldownUntil && Date.now() >= record.cooldownUntil) {
      record.cooldownUntil = null;
      record.attempts = [];
    }

    // Prune old attempts
    pruneOldAttempts(record);

    // Check attempt count
    if (record.attempts.length >= MAX_PIN_ATTEMPTS) {
      // Trigger cooldown with escalation
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
