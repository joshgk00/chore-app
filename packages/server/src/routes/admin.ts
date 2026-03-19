import { Router } from "express";
import type Database from "better-sqlite3";
import { getAllSettings } from "../services/settingsService.js";

export function createAdminRoutes(db: Database.Database) {
  const router = Router();

  router.get("/settings", (_req, res) => {
    res.json({ data: getAllSettings(db) });
  });

  return router;
}
