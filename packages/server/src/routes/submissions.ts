import { Router } from "express";
import type { RoutineService } from "../services/routineService.js";
import type { SettingsService } from "../services/settingsService.js";
import { ValidationError } from "../lib/errors.js";
import { resolveSlotContext } from "../lib/timeSlots.js";
import { createSubmissionRateLimiter } from "../middleware/submissionRateLimiter.js";

export function createSubmissionRoutes(
  routineService: RoutineService,
  settingsService: SettingsService,
) {
  const router = Router();
  const rateLimiter = createSubmissionRateLimiter();

  router.use(rateLimiter);

  router.post("/routine-completions", (req, res, next) => {
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

  return router;
}
