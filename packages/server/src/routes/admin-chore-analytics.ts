import { Router } from "express";
import type { ChoreAnalyticsService } from "../services/choreAnalyticsService.js";
import type { SettingsService } from "../services/settingsService.js";

export function createAdminChoreAnalyticsRoutes(
  analyticsService: ChoreAnalyticsService,
  settingsService: SettingsService,
) {
  const router = Router();

  router.get("/chore-analytics", (_req, res, next) => {
    try {
      const timezone =
        settingsService.getSetting("timezone") ?? "America/New_York";
      const localToday = new Date().toLocaleDateString("en-CA", {
        timeZone: timezone,
      });
      const choreEngagement = analyticsService.getChoreEngagement(localToday);
      res.json({ data: choreEngagement });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
