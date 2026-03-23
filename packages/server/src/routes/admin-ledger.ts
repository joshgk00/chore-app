import { Router } from "express";
import type { PointsService } from "../services/pointsService.js";
import { ValidationError } from "../lib/errors.js";

const VALID_ENTRY_TYPES = ["routine", "chore", "reward", "manual"] as const;

function parseIntParam(value: unknown, defaultVal: number): number {
  if (value === undefined || value === null) return defaultVal;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return defaultVal;
  return parsed;
}

export function createAdminLedgerRoutes(pointsService: PointsService) {
  const router = Router();

  router.get("/points/ledger", (req, res, next) => {
    try {
      const limit = parseIntParam(req.query.limit, 50);
      const offset = parseIntParam(req.query.offset, 0);
      const rawType = typeof req.query.entry_type === "string" ? req.query.entry_type : undefined;
      if (rawType && !VALID_ENTRY_TYPES.includes(rawType as typeof VALID_ENTRY_TYPES[number])) {
        throw new ValidationError(`Invalid entry_type. Must be one of: ${VALID_ENTRY_TYPES.join(", ")}`);
      }

      const entries = pointsService.getLedgerFiltered({ limit, offset, entryType: rawType });
      const balance = pointsService.getBalance();

      res.json({ data: { entries, balance } });
    } catch (err) {
      next(err);
    }
  });

  router.post("/points/adjust", (req, res, next) => {
    try {
      const { amount, note } = req.body;

      if (amount === undefined || typeof amount !== "number") {
        throw new ValidationError("amount is required and must be a number");
      }
      if (note === undefined || typeof note !== "string") {
        throw new ValidationError("note is required and must be a string");
      }

      const entry = pointsService.createAdjustment(amount, note);
      const balance = pointsService.getBalance();

      res.status(201).json({ data: { entry, balance } });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
