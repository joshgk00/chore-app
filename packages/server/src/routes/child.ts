import { Router } from "express";
import type { RoutineService } from "../services/routineService.js";
import type { ChoreService } from "../services/choreService.js";
import type { RewardService } from "../services/rewardService.js";
import type { PointsService } from "../services/pointsService.js";
import type { BadgeService } from "../services/badgeService.js";
import type { ActivityService } from "../services/activityService.js";
import type { SettingsService } from "../services/settingsService.js";
import { ValidationError } from "../lib/errors.js";
import { isRoutineVisible, resolveSlotContext } from "../lib/timeSlots.js";

export function createChildRoutes(
  routineService: RoutineService,
  choreService: ChoreService,
  rewardService: RewardService,
  pointsService: PointsService,
  badgeService: BadgeService,
  activityService: ActivityService,
  settingsService: SettingsService,
) {
  const router = Router();

  router.get("/routines", (_req, res, next) => {
    try {
      const routines = routineService.getActiveRoutines();
      res.json({ data: routines });
    } catch (err) {
      next(err);
    }
  });

  router.get("/routines/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid routine ID");
      }
      const id = Number(idParam);
      const routine = routineService.getRoutineById(id);
      res.json({ data: routine });
    } catch (err) {
      next(err);
    }
  });

  router.get("/chores", (_req, res, next) => {
    try {
      const chores = choreService.getActiveChores();
      res.json({ data: chores });
    } catch (err) {
      next(err);
    }
  });

  router.get("/rewards", (_req, res, next) => {
    try {
      const rewards = rewardService.getActiveRewards();
      res.json({ data: rewards });
    } catch (err) {
      next(err);
    }
  });

  router.get("/points/summary", (_req, res, next) => {
    try {
      const balance = pointsService.getBalance();
      res.json({ data: balance });
    } catch (err) {
      next(err);
    }
  });

  router.get("/points/ledger", (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      const entries = pointsService.getLedger({ limit, offset });
      res.json({ data: entries });
    } catch (err) {
      next(err);
    }
  });

  router.get("/badges", (_req, res, next) => {
    try {
      const badges = badgeService.getEarnedBadges();
      res.json({ data: badges });
    } catch (err) {
      next(err);
    }
  });

  router.get("/activity/recent", (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
      const events = activityService.getRecentActivity(limit);
      res.json({ data: events });
    } catch (err) {
      next(err);
    }
  });

  router.get("/app/bootstrap", (_req, res, next) => {
    try {
      const routines = routineService.getActiveRoutines();
      const { timezone, slotConfig } = resolveSlotContext(settingsService.getAllSettings());
      const now = new Date();
      const filteredRoutines = routines.filter((r) =>
        isRoutineVisible(r.timeSlot, now, timezone, slotConfig),
      );
      const pendingRoutineCount = routineService.getPendingCompletionCount();
      const pendingChoreCount = choreService.getPendingChoreLogCount();
      const pointsSummary = pointsService.getBalance();
      const pendingRewardCount = rewardService.getPendingRewardRequestCount();
      const recentBadges = badgeService.getRecentBadges(3);
      res.json({
        data: {
          routines: filteredRoutines,
          pendingRoutineCount,
          pendingChoreCount,
          pointsSummary,
          pendingRewardCount,
          recentBadges,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
