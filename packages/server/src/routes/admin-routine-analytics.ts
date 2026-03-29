import { Router } from "express";
import type { RoutineAnalyticsService } from "../services/routineAnalyticsService.js";
import type { SettingsService } from "../services/settingsService.js";

export function createAdminRoutineAnalyticsRoutes(
  analyticsService: RoutineAnalyticsService,
  settingsService: SettingsService,
) {
  const router = Router();

  router.get("/routine-analytics", (_req, res, next) => {
    try {
      const timezone =
        settingsService.getSetting("timezone") ?? "America/New_York";
      const localToday = new Date().toLocaleDateString("en-CA", {
        timeZone: timezone,
      });
      const routineHealth = analyticsService.getRoutineHealth(localToday);
      res.json({ data: routineHealth });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
