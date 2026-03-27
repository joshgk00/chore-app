import { Router } from "express";
import type { RoutineService } from "../services/routineService.js";
import type { ChoreService } from "../services/choreService.js";
import type { RewardService } from "../services/rewardService.js";
import type { SettingsService } from "../services/settingsService.js";
import { ValidationError } from "../lib/errors.js";
import { resolveSlotContext } from "../lib/timeSlots.js";
import { createSubmissionRateLimiter } from "../middleware/submissionRateLimiter.js";

export function createSubmissionRoutes(
  routineService: RoutineService,
  choreService: ChoreService,
  rewardService: RewardService,
  settingsService: SettingsService,
) {
  const router = Router();
  const rateLimiter = createSubmissionRateLimiter();

  router.post("/routine-completions", rateLimiter, (req, res, next) => {
    try {
      const {
        routineId,
        checklistSnapshot,
        randomizedOrder,
        idempotencyKey,
        localDate,
      } = req.body;

      if (typeof routineId !== "number" || !Number.isInteger(routineId) || routineId < 1)
        throw new ValidationError("routineId must be a positive integer");
      if (!checklistSnapshot || typeof checklistSnapshot !== "string")
        throw new ValidationError("checklistSnapshot is required");
      try {
        JSON.parse(checklistSnapshot);
      } catch {
        throw new ValidationError("checklistSnapshot must be valid JSON");
      }
      if (!idempotencyKey || typeof idempotencyKey !== "string")
        throw new ValidationError("idempotencyKey is required");
      if (!localDate || typeof localDate !== "string")
        throw new ValidationError("localDate is required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate))
        throw new ValidationError("localDate must be in YYYY-MM-DD format");
      if (idempotencyKey.length > 255)
        throw new ValidationError("idempotencyKey exceeds maximum length");
      if (checklistSnapshot.length > 10000)
        throw new ValidationError("checklistSnapshot exceeds maximum length");
      if (randomizedOrder !== undefined && randomizedOrder !== null) {
        if (typeof randomizedOrder !== "string")
          throw new ValidationError("randomizedOrder must be a string");
        if (randomizedOrder.length > 2000)
          throw new ValidationError("randomizedOrder exceeds maximum length");
      }

      const { currentSlot } = resolveSlotContext(settingsService.getAllSettings());

      const completion = routineService.submitCompletion({
        routineId,
        checklistSnapshot,
        randomizedOrder: randomizedOrder ?? null,
        idempotencyKey,
        localDate,
        timeSlot: currentSlot,
      });

      res.status(201).json({ data: completion });
    } catch (err) {
      next(err);
    }
  });

  router.post("/chore-logs", rateLimiter, (req, res, next) => {
    try {
      const { choreId, tierId, idempotencyKey, localDate } = req.body;

      if (typeof choreId !== "number" || !Number.isInteger(choreId) || choreId < 1)
        throw new ValidationError("choreId must be a positive integer");
      if (typeof tierId !== "number" || !Number.isInteger(tierId) || tierId < 1)
        throw new ValidationError("tierId must be a positive integer");
      if (!idempotencyKey || typeof idempotencyKey !== "string")
        throw new ValidationError("idempotencyKey is required");
      if (!localDate || typeof localDate !== "string")
        throw new ValidationError("localDate is required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate))
        throw new ValidationError("localDate must be in YYYY-MM-DD format");
      if (idempotencyKey.length > 255)
        throw new ValidationError("idempotencyKey exceeds maximum length");

      const log = choreService.submitChoreLog({
        choreId,
        tierId,
        idempotencyKey,
        localDate,
      });

      res.status(201).json({ data: log });
    } catch (err) {
      next(err);
    }
  });

  router.get("/chore-logs/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid chore log ID");
      }
      const id = Number(idParam);
      if (!Number.isInteger(id) || id < 1) {
        throw new ValidationError("Invalid chore log ID");
      }
      const log = choreService.getChoreLog(id);
      res.json({ data: log });
    } catch (err) {
      next(err);
    }
  });

  router.post("/chore-logs/:id/cancel", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid chore log ID");
      }
      const id = Number(idParam);
      if (!Number.isInteger(id) || id < 1) {
        throw new ValidationError("Invalid chore log ID");
      }
      const log = choreService.cancelChoreLog(id);
      res.json({ data: log });
    } catch (err) {
      next(err);
    }
  });

  router.post("/reward-requests", rateLimiter, (req, res, next) => {
    try {
      const { rewardId, idempotencyKey, localDate } = req.body;

      if (typeof rewardId !== "number" || !Number.isInteger(rewardId) || rewardId < 1)
        throw new ValidationError("rewardId must be a positive integer");
      if (!idempotencyKey || typeof idempotencyKey !== "string")
        throw new ValidationError("idempotencyKey is required");
      if (!localDate || typeof localDate !== "string")
        throw new ValidationError("localDate is required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate))
        throw new ValidationError("localDate must be in YYYY-MM-DD format");
      if (idempotencyKey.length > 255)
        throw new ValidationError("idempotencyKey exceeds maximum length");

      const request = rewardService.submitRequest({
        rewardId,
        idempotencyKey,
        localDate,
      });

      res.status(201).json({ data: request });
    } catch (err) {
      next(err);
    }
  });

  router.post("/reward-requests/:id/cancel", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid reward request ID");
      }
      const id = Number(idParam);
      if (!Number.isInteger(id) || id < 1) {
        throw new ValidationError("Invalid reward request ID");
      }
      const request = rewardService.cancelRequest(id);
      res.json({ data: request });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
