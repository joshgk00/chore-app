import { Router } from "express";
import type { SettingsService } from "../services/settingsService.js";

export function createAdminRoutes(settingsService: SettingsService) {
  const router = Router();

  router.get("/settings", (_req, res, next) => {
    try {
      res.json({ data: settingsService.getPublicSettings() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
