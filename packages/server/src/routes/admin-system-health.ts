import { Router } from "express";
import type { SystemHealthService } from "../services/systemHealthService.js";

export function createAdminSystemHealthRoutes(
  systemHealthService: SystemHealthService,
) {
  const router = Router();

  router.get("/system-health", (_req, res, next) => {
    try {
      const stats = systemHealthService.getSystemHealth();
      res.json({ data: stats });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
