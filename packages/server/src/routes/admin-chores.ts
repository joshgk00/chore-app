import { Router } from "express";
import type { ChoreService, UpdateChoreData } from "../services/choreService.js";
import { ValidationError } from "../lib/errors.js";

export function createAdminChoresRoutes(choreService: ChoreService) {
  const router = Router();

  router.get("/chores", (_req, res, next) => {
    try {
      const chores = choreService.listChoresAdmin();
      res.json({ data: chores });
    } catch (err) {
      next(err);
    }
  });

  router.get("/chores/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid chore ID");
      }
      const chore = choreService.getChoreAdmin(Number(idParam));
      res.json({ data: chore });
    } catch (err) {
      next(err);
    }
  });

  router.post("/chores", (req, res, next) => {
    try {
      const { name, requiresApproval, sortOrder, tiers } = req.body;

      if (typeof name !== "string" || name.trim().length === 0) {
        throw new ValidationError("name is required");
      }
      if (name.trim().length > 200) {
        throw new ValidationError("name must be 200 characters or fewer");
      }
      if (typeof requiresApproval !== "boolean") {
        throw new ValidationError("requiresApproval must be a boolean");
      }
      if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
        throw new ValidationError("sortOrder must be an integer between 0 and 9999");
      }
      if (!Array.isArray(tiers) || tiers.length === 0) {
        throw new ValidationError("At least one tier is required");
      }
      if (tiers.length > 20) {
        throw new ValidationError("A chore can have at most 20 tiers");
      }
      for (const tier of tiers) {
        if (typeof tier.name !== "string" || tier.name.trim().length === 0) {
          throw new ValidationError("Each tier must have a non-empty name");
        }
        if (tier.name.trim().length > 200) {
          throw new ValidationError("Each tier name must be 200 characters or fewer");
        }
        if (typeof tier.points !== "number" || !Number.isInteger(tier.points) || tier.points < 0 || tier.points > 10000) {
          throw new ValidationError("Each tier points must be an integer between 0 and 10000");
        }
        if (typeof tier.sortOrder !== "number" || !Number.isInteger(tier.sortOrder) || tier.sortOrder < 0 || tier.sortOrder > 9999) {
          throw new ValidationError("Each tier sortOrder must be an integer between 0 and 9999");
        }
      }

      const chore = choreService.createChore({
        name: name.trim(),
        requiresApproval,
        sortOrder,
        tiers: tiers.map((t: { name: string; points: number; sortOrder: number }) => ({
          name: t.name.trim(),
          points: t.points,
          sortOrder: t.sortOrder,
        })),
      });

      res.status(201).json({ data: chore });
    } catch (err) {
      next(err);
    }
  });

  router.put("/chores/:id", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid chore ID");
      }

      const { name, requiresApproval, sortOrder, tiers } = req.body;

      if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
        throw new ValidationError("name must be a non-empty string");
      }
      if (name !== undefined && name.trim().length > 200) {
        throw new ValidationError("name must be 200 characters or fewer");
      }
      if (requiresApproval !== undefined && typeof requiresApproval !== "boolean") {
        throw new ValidationError("requiresApproval must be a boolean");
      }
      if (sortOrder !== undefined && (typeof sortOrder !== "number" || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999)) {
        throw new ValidationError("sortOrder must be an integer between 0 and 9999");
      }
      if (tiers !== undefined) {
        if (!Array.isArray(tiers)) {
          throw new ValidationError("tiers must be an array");
        }
        if (tiers.length > 20) {
          throw new ValidationError("A chore can have at most 20 tiers");
        }
        for (const tier of tiers) {
          if (tier.id !== undefined && (typeof tier.id !== "number" || !Number.isInteger(tier.id) || tier.id < 1)) {
            throw new ValidationError("Each tier.id must be a positive integer");
          }
          if (tier.shouldArchive !== undefined && typeof tier.shouldArchive !== "boolean") {
            throw new ValidationError("Each tier.shouldArchive must be a boolean");
          }
          if (typeof tier.name !== "string" || tier.name.trim().length === 0) {
            throw new ValidationError("Each tier must have a non-empty name");
          }
          if (tier.name.trim().length > 200) {
            throw new ValidationError("Each tier name must be 200 characters or fewer");
          }
          if (typeof tier.points !== "number" || !Number.isInteger(tier.points) || tier.points < 0 || tier.points > 10000) {
            throw new ValidationError("Each tier points must be an integer between 0 and 10000");
          }
          if (typeof tier.sortOrder !== "number" || !Number.isInteger(tier.sortOrder) || tier.sortOrder < 0 || tier.sortOrder > 9999) {
            throw new ValidationError("Each tier sortOrder must be an integer between 0 and 9999");
          }
        }
      }

      const updateData: UpdateChoreData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (requiresApproval !== undefined) updateData.requiresApproval = requiresApproval;
      if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
      if (tiers !== undefined) {
        updateData.tiers = tiers.map((t: { id?: number; name: string; points: number; sortOrder: number; shouldArchive?: boolean }) => ({
          id: t.id,
          name: t.name.trim(),
          points: t.points,
          sortOrder: t.sortOrder,
          shouldArchive: t.shouldArchive,
        }));
      }

      const chore = choreService.updateChore(Number(idParam), updateData);
      res.json({ data: chore });
    } catch (err) {
      next(err);
    }
  });

  router.post("/chores/:id/archive", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid chore ID");
      }
      choreService.archiveChore(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/chores/:id/unarchive", (req, res, next) => {
    try {
      const idParam = req.params.id;
      if (!/^\d+$/.test(idParam)) {
        throw new ValidationError("Invalid chore ID");
      }
      choreService.unarchiveChore(Number(idParam));
      res.json({ data: { success: true } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
