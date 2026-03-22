import { Router } from "express";
import { SESSION_COOKIE_NAME } from "@chore-app/shared";
import { AuthError } from "../lib/errors.js";
import { createRateLimiter } from "../middleware/rateLimiter.js";
import type { AppConfig } from "../config.js";
import { clearSessionCookie, setSessionCookie } from "../lib/sessionCookie.js";
import type { AuthService } from "../services/authService.js";

export function createAuthRoutes(authService: AuthService, config: AppConfig) {
  const router = Router();
  const rateLimiter = createRateLimiter();

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
      setSessionCookie(res, token, config);
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

      setSessionCookie(res, token, config);
      res.json({ data: { valid: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/lock", (_req, res, next) => {
    try {
      clearSessionCookie(res, config);
      res.json({ data: { locked: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/logout", (req, res, next) => {
    try {
      const token = req.cookies[SESSION_COOKIE_NAME];
      if (token) {
        authService.destroySession(token);
      }

      clearSessionCookie(res, config);
      res.json({ data: { loggedOut: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
