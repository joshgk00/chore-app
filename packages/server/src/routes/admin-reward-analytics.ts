import { Router } from "express";
import type { RewardAnalyticsService } from "../services/rewardAnalyticsService.js";

export function createAdminRewardAnalyticsRoutes(
  analyticsService: RewardAnalyticsService,
) {
  const router = Router();

  router.get("/reward-analytics", (_req, res, next) => {
    try {
      const rewardDemand = analyticsService.getRewardDemand();
      res.json({ data: rewardDemand });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
