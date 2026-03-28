import { Router } from "express";
import type { RewardService, UpdateRewardData } from "../services/rewardService.js";
import { ValidationError } from "../lib/errors.js";
import { parseIdParam } from "../lib/parse-id-param.js";

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
      const id = parseIdParam(req.params.id, "reward ID");
      const reward = rewardService.getRewardAdmin(id);
      res.json({ data: reward });
    } catch (err) {
      next(err);
    }
  });

  router.post("/rewards", (req, res, next) => {
    try {
      const { name, pointsCost, sortOrder, imageAssetId } = req.body;

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
      if (imageAssetId !== undefined && imageAssetId !== null &&
          (typeof imageAssetId !== "number" || !Number.isInteger(imageAssetId) || imageAssetId < 1)) {
        throw new ValidationError("imageAssetId must be a positive integer or null");
      }

      const reward = rewardService.createReward({
        name: name.trim(),
        pointsCost,
        sortOrder,
        imageAssetId: imageAssetId ?? null,
      });

      res.status(201).json({ data: reward });
    } catch (err) {
      next(err);
    }
  });

  router.put("/rewards/:id", (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id, "reward ID");

      const { name, pointsCost, sortOrder, imageAssetId } = req.body;

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
      if (imageAssetId !== undefined && imageAssetId !== null &&
          (typeof imageAssetId !== "number" || !Number.isInteger(imageAssetId) || imageAssetId < 1)) {
        throw new ValidationError("imageAssetId must be a positive integer or null");
      }

      const updateData: UpdateRewardData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (pointsCost !== undefined) updateData.pointsCost = pointsCost;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (imageAssetId !== undefined) updateData.imageAssetId = imageAssetId;

      const reward = rewardService.updateReward(id, updateData);
      res.json({ data: reward });
    } catch (err) {
      next(err);
    }
  });

  router.post("/rewards/:id/archive", (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id, "reward ID");
      rewardService.archiveReward(id);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/rewards/:id/unarchive", (req, res, next) => {
    try {
      const id = parseIdParam(req.params.id, "reward ID");
      rewardService.unarchiveReward(id);
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
