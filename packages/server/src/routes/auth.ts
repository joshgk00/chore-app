import { Router } from "express";
import type { Request, Response } from "express";
import { SESSION_COOKIE_NAME } from "@chore-app/shared";
import { AuthError } from "../lib/errors.js";
import type { AuthService } from "../services/authService.js";
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
    maxAge: 600_000,
  };
}

export function createAuthRoutes(authService: AuthService, config: AppConfig) {
  const router = Router();
  const rateLimiter = createRateLimiter();

  function clearSession(req: Request, res: Response): void {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token) {
      authService.destroySession(token);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/api" });
  }

  router.post("/verify", rateLimiter, async (req, res, next) => {
    try {
      const { pin } = req.body;
      if (!pin || typeof pin !== "string") {
        throw new AuthError("Invalid credentials");
      }

      const isVerified = await authService.verifyPin(pin);
      if (!isVerified) {
        rateLimiter.recordFailure(req.ip || "unknown");
        throw new AuthError("Invalid credentials");
      }

      const { token } = authService.createSession();
      res.cookie(SESSION_COOKIE_NAME, token, cookieOptions(config));
      res.json({ data: { valid: true } });
    } catch (err) {
      next(err);
    }
  });

  router.get("/session", (req, res, next) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (!token) {
        throw new AuthError("No session");
      }

      const session = authService.validateSession(token);
      if (!session) {
        throw new AuthError("Invalid session");
      }

      res.json({ data: { valid: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/lock", (req, res, next) => {
    try {
      clearSession(req, res);
      res.json({ data: { locked: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", (req, res, next) => {
    try {
      clearSession(req, res);
      res.json({ data: { loggedOut: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
