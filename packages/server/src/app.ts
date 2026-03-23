import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { NotFoundError } from "./lib/errors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAdminRoutinesRoutes } from "./routes/admin-routines.js";
import { createAdminChoresRoutes } from "./routes/admin-chores.js";
import { createAdminRewardsRoutes } from "./routes/admin-rewards.js";
import { createAdminApprovalsRoutes } from "./routes/admin-approvals.js";
import { createAdminLedgerRoutes } from "./routes/admin-ledger.js";
import { createChildRoutes } from "./routes/child.js";
import { createSubmissionRoutes } from "./routes/submissions.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { createAuthService } from "./services/authService.js";
import { createSettingsService } from "./services/settingsService.js";
import { createActivityService } from "./services/activityService.js";
import { createRoutineService } from "./services/routineService.js";
import { createChoreService } from "./services/choreService.js";
import { createRewardService } from "./services/rewardService.js";
import { createApprovalService } from "./services/approvalService.js";
import { createPointsService } from "./services/pointsService.js";
import { createBadgeService } from "./services/badgeService.js";
import type { AppConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db: Database.Database, config: AppConfig) {
  const app = express();

  // Trust proxy for Cloudflare Tunnel
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const authService = createAuthService(db);
  const settingsService = createSettingsService(db);
  const activityService = createActivityService(db);
  const badgeService = createBadgeService(db);
  const routineService = createRoutineService(db, activityService, badgeService);
  const choreService = createChoreService(db, activityService, badgeService);
  const rewardService = createRewardService(db, activityService);
  const pointsService = createPointsService(db, activityService);
  const approvalService = createApprovalService(db, activityService, badgeService);

  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.use("/api/auth", createAuthRoutes(authService, config));

  app.use("/api", createChildRoutes(routineService, choreService, rewardService, pointsService, badgeService, activityService, settingsService));
  app.use("/api", createSubmissionRoutes(routineService, choreService, rewardService, settingsService));

  app.use("/api/admin", adminAuth(authService, config));
  app.use("/api/admin", createAdminRoutes(settingsService));
  app.use("/api/admin", createAdminRoutinesRoutes(routineService));
  app.use("/api/admin", createAdminChoresRoutes(choreService));
  app.use("/api/admin", createAdminRewardsRoutes(rewardService));
  app.use("/api/admin", createAdminApprovalsRoutes(approvalService));
  app.use("/api/admin", createAdminLedgerRoutes(pointsService));

  app.all("/api/*", (_req, _res, next) => {
    next(new NotFoundError("API endpoint not found"));
  });

  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
