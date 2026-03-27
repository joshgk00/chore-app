import type { Request, Response, NextFunction } from "express";
import {
  SUBMISSION_RATE_LIMIT_MAX,
  SUBMISSION_RATE_LIMIT_WINDOW_SECONDS,
} from "@chore-app/shared";

const MAX_TRACKED_IPS = 10_000;

interface SubmissionRecord {
  timestamps: number[];
}

export interface SubmissionRateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  _store: Map<string, SubmissionRecord>;
}

export function createSubmissionRateLimiter(): SubmissionRateLimiterMiddleware {
  const store = new Map<string, SubmissionRecord>();
  const windowMs = SUBMISSION_RATE_LIMIT_WINDOW_SECONDS * 1000;

  const cleanup = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [ip, record] of store) {
      record.timestamps = record.timestamps.filter((t) => t > cutoff);
      if (record.timestamps.length === 0) store.delete(ip);
    }
  }, 60_000);
  cleanup.unref();

  const middleware: SubmissionRateLimiterMiddleware = ((
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const ip = req.ip || "unknown";
    let record = store.get(ip);
    if (!record) {
      if (store.size >= MAX_TRACKED_IPS) {
        next();
        return;
      }
      record = { timestamps: [] };
      store.set(ip, record);
    }

    const cutoff = Date.now() - windowMs;
    record.timestamps = record.timestamps.filter((t) => t > cutoff);

    if (record.timestamps.length >= SUBMISSION_RATE_LIMIT_MAX) {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many submissions. Please wait.",
        },
      });
      return;
    }

    record.timestamps.push(Date.now());
    next();
  }) as SubmissionRateLimiterMiddleware;

  middleware._store = store;

  return middleware;
}
