import { Router } from "express";
import { PIN_MIN_LENGTH } from "@chore-app/shared";
import { AuthError, ValidationError } from "../lib/errors.js";
import { clearSessionCookie } from "../lib/sessionCookie.js";
import type { AppConfig } from "../config.js";
import type { SettingsService } from "../services/settingsService.js";
import type { AuthService } from "../services/authService.js";

export function createAdminSettingsRoutes(
  settingsService: SettingsService,
  authService: AuthService,
  config: AppConfig,
) {
  const router = Router();

  router.get("/settings", (_req, res, next) => {
    try {
      res.json({ data: settingsService.getPublicSettings() });
    } catch (err) {
      next(err);
    }
  });

  router.put("/settings", (req, res, next) => {
    try {
      const updates = req.body;

      if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
        throw new ValidationError("Request body must be an object of key-value pairs");
      }

      for (const value of Object.values(updates)) {
        if (typeof value !== "string") {
          throw new ValidationError("All setting values must be strings");
        }
      }

      const updatedSettings = settingsService.updateSettings(updates as Record<string, string>);
      res.json({ data: updatedSettings });
    } catch (err) {
      next(err);
    }
  });

  router.put("/settings/pin", async (req, res, next) => {
    try {
      const { currentPin, newPin } = req.body;

      if (!currentPin || typeof currentPin !== "string") {
        throw new ValidationError("currentPin is required");
      }

      const isValid = await authService.verifyPin(currentPin);
      if (!isValid) {
        throw new AuthError("Current PIN is incorrect");
      }

      if (!newPin || typeof newPin !== "string" || newPin.length < PIN_MIN_LENGTH) {
        throw new ValidationError(`PIN must be at least ${PIN_MIN_LENGTH} digits`);
      }

      await settingsService.updatePin(newPin);

      authService.destroyAllSessions();
      clearSessionCookie(res, config);

      res.json({ data: { pinChanged: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
