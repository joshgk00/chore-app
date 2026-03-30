import { Router } from "express";
import { ENTRY_TYPES } from "@chore-app/shared";
import type { EntryType } from "@chore-app/shared";
import type { PointsService } from "../services/pointsService.js";
import type { SettingsService } from "../services/settingsService.js";
import { ValidationError } from "../lib/errors.js";

function parseIntParam(value: unknown, defaultVal: number): number {
  if (value === undefined || value === null) return defaultVal;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return defaultVal;
  return parsed;
}

export function createAdminLedgerRoutes(pointsService: PointsService, settingsService?: SettingsService) {
  const router = Router();

  router.get("/points/ledger", (req, res, next) => {
    try {
      const limit = parseIntParam(req.query.limit, 50);
      const offset = parseIntParam(req.query.offset, 0);
      const rawType = typeof req.query.entry_type === "string" ? req.query.entry_type : undefined;
      if (rawType && !(ENTRY_TYPES as readonly string[]).includes(rawType)) {
        throw new ValidationError(`Invalid entry_type. Must be one of: ${ENTRY_TYPES.join(", ")}`);
      }

      const entries = pointsService.getLedgerFiltered({ limit, offset, entryType: rawType as EntryType | undefined });
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

  router.get("/points/economy", (_req, res, next) => {
    try {
      const timezone =
        settingsService?.getSetting("timezone") ?? "America/New_York";
      const economy = pointsService.getPointsEconomy(timezone);
      res.json({ data: economy });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
