import { Router } from "express";
import type { RoutineService } from "../services/routineService.js";
import type { SettingsService } from "../services/settingsService.js";
import { ValidationError } from "../lib/errors.js";
import { isRoutineVisible, resolveSlotContext } from "../lib/timeSlots.js";

export function createChildRoutes(
  routineService: RoutineService,
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

  router.get("/app/bootstrap", (_req, res, next) => {
    try {
      const routines = routineService.getActiveRoutines();
      const { timezone, slotConfig } = resolveSlotContext(settingsService.getAllSettings());
      const now = new Date();
      const filteredRoutines = routines.filter((r) =>
        isRoutineVisible(r.timeSlot, now, timezone, slotConfig),
      );
      const pendingRoutineCount = routineService.getPendingCompletionCount();
      res.json({ data: { routines: filteredRoutines, pendingRoutineCount } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
