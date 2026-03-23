import { Router } from "express";
import type { RewardService, UpdateRewardData } from "../services/rewardService.js";
import { ValidationError } from "../lib/errors.js";

export function createAdminRewardsRoutes(rewardService: RewardService) {
  const router = Router();

  router.get("/rewards", (_req, res, next) => {
    try {
      const rewards = rewardService.listRewardsAdmin();
      res.json({ data: rewards });
    } catch (err) {
      next(err);
    }
  });

  router.get("/rewards/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid reward ID");
      }
      const reward = rewardService.getRewardAdmin(Number(idParam));
      res.json({ data: reward });
    } catch (err) {
      next(err);
    }
  });

  router.post("/rewards", (req, res, next) => {
    try {
      const { name, pointsCost, sortOrder } = req.body;

      if (typeof name !== "string" || name.trim().length === 0) {
        throw new ValidationError("name is required");
      }
      if (name.trim().length > 200) {
        throw new ValidationError("name must be 200 characters or fewer");
      }
      if (typeof pointsCost !== "number" || !Number.isInteger(pointsCost) || pointsCost < 0 || pointsCost > 10000) {
        throw new ValidationError("Points cost must be an integer between 0 and 10,000");
      }
      if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
        throw new ValidationError("Sort order must be an integer between 0 and 9,999");
      }

      const reward = rewardService.createReward({
        name: name.trim(),
        pointsCost,
        sortOrder,
      });

      res.status(201).json({ data: reward });
    } catch (err) {
      next(err);
    }
  });

  router.put("/rewards/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid reward ID");
      }

      const { name, pointsCost, sortOrder } = req.body;

      if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        throw new ValidationError("name must be a non-empty string");
      }
      if (name !== undefined && name.trim().length > 200) {
        throw new ValidationError("name must be 200 characters or fewer");
      }
      if (pointsCost !== undefined && (typeof pointsCost !== "number" || !Number.isInteger(pointsCost) || pointsCost < 0 || pointsCost > 10000)) {
        throw new ValidationError("Points cost must be an integer between 0 and 10,000");
      }
      if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999)) {
        throw new ValidationError("Sort order must be an integer between 0 and 9,999");
      }

      const updateData: UpdateRewardData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (pointsCost !== undefined) updateData.pointsCost = pointsCost;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

      const reward = rewardService.updateReward(Number(idParam), updateData);
      res.json({ data: reward });
    } catch (err) {
      next(err);
    }
  });

  router.post("/rewards/:id/archive", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid reward ID");
      }
      rewardService.archiveReward(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/rewards/:id/unarchive", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid reward ID");
      }
      rewardService.unarchiveReward(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
