import { Router } from "express";
import type Database from "better-sqlite3";
import { SESSION_COOKIE_NAME } from "@chore-app/shared";
import { AuthError } from "../lib/errors.js";
import {
  verifyPin,
  createSession,
  validateSession,
  destroySession,
} from "../services/authService.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import type { AppConfig } from "../config.js";

function cookieOptions(config: AppConfig) {
  const isLocalhost =
    config.publicOrigin.includes("localhost") || config.publicOrigin.includes("127.0.0.1");
  return {
    httpOnly: true,
    secure: !isLocalhost,
    sameSite: "strict" as const,
    path: "/api",
    maxAge: 600_000, // 10 minutes in ms
  };
}

export function createAuthRoutes(db: Database.Database, config: AppConfig) {
  const router = Router();
  const rateLimiter = createRateLimiter();

  // POST /api/auth/verify
  router.post("/verify", rateLimiter, (req, res, next) => {
    try {
      const { pin } = req.body;
      if (!pin || typeof pin !== "string") {
        throw new AuthError("Invalid credentials");
      }

      const verified = verifyPin(db, pin);
      if (!verified) {
        // Record failed attempt for rate limiting
        rateLimiter.recordFailure(req.ip || "unknown");
        throw new AuthError("Invalid credentials");
      }

      const { token } = createSession(db);
      res.cookie(SESSION_COOKIE_NAME, token, cookieOptions(config));
      res.json({ data: { valid: true } });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/auth/session
  router.get("/session", (req, res, next) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (!token) {
        throw new AuthError("No session");
      }

      const session = validateSession(db, token);
      if (!session) {
        throw new AuthError("Invalid session");
      }

      res.json({ data: { valid: true } });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/lock
  router.post("/lock", (req, res, next) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (token) {
        destroySession(db, token);
      }
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/api" });
      res.json({ data: { locked: true } });
    } catch (err) {
      next(err);
    }
  });

  // POST /api/auth/logout
  router.post("/logout", (req, res, next) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (token) {
        destroySession(db, token);
      }
      res.clearCookie(SESSION_COOKIE_NAME, { path: "/api" });
      res.json({ data: { loggedOut: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
