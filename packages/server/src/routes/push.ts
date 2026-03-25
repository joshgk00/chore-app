import { Router } from "express";
import type { PushService } from "../services/pushService.js";
import type { AuthService } from "../services/authService.js";
import type { AppConfig } from "../config.js";
import { ValidationError, AuthError } from "../lib/errors.js";
import { SESSION_COOKIE_NAME } from "@chore-app/shared";
import { setSessionCookie } from "../lib/sessionCookie.js";
import { createSubmissionRateLimiter } from "../middleware/submissionRateLimiter.js";

const VALID_ROLES = ["child", "admin"] as const;

export function createPushRoutes(
  pushService: PushService,
  authService: AuthService,
  config: AppConfig,
) {
  const router = Router();
  const rateLimiter = createSubmissionRateLimiter();

  router.get("/vapid-public-key", (_req, res, next) => {
    try {
      const key = pushService.getVapidPublicKey();
      res.json({ data: { key } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/subscribe", rateLimiter, (req, res, next) => {
    try {
      const { role, endpoint, p256dh, auth } = req.body;

      if (!role || !VALID_ROLES.includes(role)) {
        throw new ValidationError("role must be 'child' or 'admin'");
      }
      if (typeof endpoint !== "string" || endpoint.trim().length === 0) {
        throw new ValidationError("endpoint is required");
      }
      if (endpoint.length > 2048) {
        throw new ValidationError("endpoint is too long");
      }
      try {
        const parsed = new URL(endpoint);
        if (parsed.protocol !== "https:") {
          throw new ValidationError("endpoint must be an HTTPS URL");
        }
      } catch (err) {
        if (err instanceof ValidationError) throw err;
        throw new ValidationError("endpoint must be a valid URL");
      }
      if (typeof p256dh !== "string" || p256dh.trim().length === 0) {
        throw new ValidationError("p256dh is required");
      }
      if (p256dh.length > 512) {
        throw new ValidationError("p256dh is too long");
      }
      if (typeof auth !== "string" || auth.trim().length === 0) {
        throw new ValidationError("auth is required");
      }
      if (auth.length > 512) {
        throw new ValidationError("auth is too long");
      }

      if (role === "admin") {
        const token = req.cookies[SESSION_COOKIE_NAME];
        if (!token) {
          throw new AuthError("Admin authentication required");
        }
        const session = authService.validateSession(token);
        if (!session) {
          throw new AuthError("Invalid or expired session");
        }
        setSessionCookie(res, token, config);
      }

      pushService.subscribe(role, endpoint, { p256dh, auth }, req.ip || "unknown");
      res.json({ data: { subscribed: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
