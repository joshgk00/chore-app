import { Router } from "express";
import type { RoutineService, UpdateRoutineData } from "../services/routineService.js";
import { ValidationError } from "../lib/errors.js";

const VALID_TIME_SLOTS = ["morning", "afternoon", "bedtime", "anytime"];
const VALID_COMPLETION_RULES = ["once_per_day", "once_per_slot", "unlimited"];

export function createAdminRoutinesRoutes(routineService: RoutineService) {
  const router = Router();

  router.get("/routines", (_req, res, next) => {
    try {
      const routines = routineService.listRoutinesAdmin();
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
      const routine = routineService.getRoutineAdmin(Number(idParam));
      res.json({ data: routine });
    } catch (err) {
      next(err);
    }
  });

  router.post("/routines", (req, res, next) => {
    try {
      const { name, timeSlot, completionRule, points, requiresApproval, randomizeItems, sortOrder, items, imageAssetId } = req.body;

      if (typeof name !== "string" || name.trim().length === 0) {
        throw new ValidationError("name is required");
      }
      if (name.trim().length > 200) {
        throw new ValidationError("name must be 200 characters or fewer");
      }
      if (!VALID_TIME_SLOTS.includes(timeSlot)) {
        throw new ValidationError("timeSlot must be one of: morning, afternoon, bedtime, anytime");
      }
      if (!VALID_COMPLETION_RULES.includes(completionRule)) {
        throw new ValidationError("completionRule must be one of: once_per_day, once_per_slot, unlimited");
      }
      if (typeof points !== "number" || !Number.isInteger(points) || points < 0 || points > 10000) {
        throw new ValidationError("points must be an integer between 0 and 10000");
      }
      if (typeof requiresApproval !== "boolean") {
        throw new ValidationError("requiresApproval must be a boolean");
      }
      if (typeof randomizeItems !== "boolean") {
        throw new ValidationError("randomizeItems must be a boolean");
      }
      if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder)) {
        throw new ValidationError("sortOrder must be an integer");
      }
      if (imageAssetId !== undefined && imageAssetId !== null &&
          (typeof imageAssetId !== "number" || !Number.isInteger(imageAssetId) || imageAssetId < 1)) {
        throw new ValidationError("imageAssetId must be a positive integer or null");
      }
      if (!Array.isArray(items) || items.length === 0) {
        throw new ValidationError("At least one checklist item is required");
      }
      if (items.length > 50) {
        throw new ValidationError("A routine can have at most 50 checklist items");
      }
      for (const item of items) {
        if (typeof item.label !== "string" || item.label.trim().length === 0) {
          throw new ValidationError("Each item must have a non-empty label");
        }
        if (item.label.trim().length > 500) {
          throw new ValidationError("Each item label must be 500 characters or fewer");
        }
        if (typeof item.sortOrder !== "number" || !Number.isInteger(item.sortOrder)) {
          throw new ValidationError("Each item must have an integer sortOrder");
        }
        if (item.imageAssetId !== undefined && item.imageAssetId !== null &&
            (typeof item.imageAssetId !== "number" || !Number.isInteger(item.imageAssetId) || item.imageAssetId < 1)) {
          throw new ValidationError("Each item.imageAssetId must be a positive integer or null");
        }
      }

      const routine = routineService.createRoutine({
        name: name.trim(),
        timeSlot,
        completionRule,
        points,
        requiresApproval,
        randomizeItems,
        sortOrder,
        imageAssetId: imageAssetId ?? null,
        items: items.map((i: { label: string; sortOrder: number; imageAssetId?: number | null }) => ({
          label: i.label.trim(),
          sortOrder: i.sortOrder,
          imageAssetId: i.imageAssetId ?? null,
        })),
      });

      res.status(201).json({ data: routine });
    } catch (err) {
      next(err);
    }
  });

  router.put("/routines/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid routine ID");
      }

      const { name, timeSlot, completionRule, points, requiresApproval, randomizeItems, sortOrder, items, imageAssetId } = req.body;

      if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        throw new ValidationError("name must be a non-empty string");
      }
      if (name !== undefined && name.trim().length > 200) {
        throw new ValidationError("name must be 200 characters or fewer");
      }
      if (timeSlot !== undefined && !VALID_TIME_SLOTS.includes(timeSlot)) {
        throw new ValidationError("timeSlot must be one of: morning, afternoon, bedtime, anytime");
      }
      if (completionRule !== undefined && !VALID_COMPLETION_RULES.includes(completionRule)) {
        throw new ValidationError("completionRule must be one of: once_per_day, once_per_slot, unlimited");
      }
      if (points !== undefined && (typeof points !== "number" || !Number.isInteger(points) || points < 0 || points > 10000)) {
        throw new ValidationError("points must be an integer between 0 and 10000");
      }
      if (requiresApproval !== undefined && typeof requiresApproval !== "boolean") {
        throw new ValidationError("requiresApproval must be a boolean");
      }
      if (randomizeItems !== undefined && typeof randomizeItems !== "boolean") {
        throw new ValidationError("randomizeItems must be a boolean");
      }
      if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder))) {
        throw new ValidationError("sortOrder must be an integer");
      }
      if (imageAssetId !== undefined && imageAssetId !== null &&
          (typeof imageAssetId !== "number" || !Number.isInteger(imageAssetId) || imageAssetId < 1)) {
        throw new ValidationError("imageAssetId must be a positive integer or null");
      }
      if (items !== undefined) {
        if (!Array.isArray(items)) {
          throw new ValidationError("items must be an array");
        }
        if (items.length > 50) {
          throw new ValidationError("A routine can have at most 50 checklist items");
        }
        for (const item of items) {
          if (item.id !== undefined && (typeof item.id !== "number" || !Number.isInteger(item.id) || item.id < 1)) {
            throw new ValidationError("Each item.id must be a positive integer");
          }
          if (item.shouldArchive !== undefined && typeof item.shouldArchive !== "boolean") {
            throw new ValidationError("Each item.shouldArchive must be a boolean");
          }
          if (typeof item.label !== "string" || item.label.trim().length === 0) {
            throw new ValidationError("Each item must have a non-empty label");
          }
          if (item.label.trim().length > 500) {
            throw new ValidationError("Each item label must be 500 characters or fewer");
          }
          if (typeof item.sortOrder !== "number" || !Number.isInteger(item.sortOrder)) {
            throw new ValidationError("Each item must have an integer sortOrder");
          }
          if (item.imageAssetId !== undefined && item.imageAssetId !== null &&
              (typeof item.imageAssetId !== "number" || !Number.isInteger(item.imageAssetId) || item.imageAssetId < 1)) {
            throw new ValidationError("Each item.imageAssetId must be a positive integer or null");
          }
        }
      }

      const updateData: UpdateRoutineData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (timeSlot !== undefined) updateData.timeSlot = timeSlot;
      if (completionRule !== undefined) updateData.completionRule = completionRule;
      if (points !== undefined) updateData.points = points;
      if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;
      if (randomizeItems !== undefined) updateData.randomizeItems = randomizeItems;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (imageAssetId !== undefined) updateData.imageAssetId = imageAssetId;
      if (items !== undefined) {
        updateData.items = items.map((i: { id?: number; label: string; sortOrder: number; shouldArchive?: boolean; imageAssetId?: number | null }) => ({
          id: i.id,
          label: i.label.trim(),
          sortOrder: i.sortOrder,
          shouldArchive: i.shouldArchive,
          imageAssetId: i.imageAssetId ?? null,
        }));
      }

      const routine = routineService.updateRoutine(Number(idParam), updateData);
      res.json({ data: routine });
    } catch (err) {
      next(err);
    }
  });

  router.post("/routines/:id/archive", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid routine ID");
      }
      routineService.archiveRoutine(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/routines/:id/unarchive", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid routine ID");
      }
      routineService.unarchiveRoutine(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
