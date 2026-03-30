import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { NotFoundError } from "./lib/errors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthRoutes } from "./routes/auth.js";
import { createAdminSettingsRoutes } from "./routes/admin-settings.js";
import { createAdminActivityRoutes } from "./routes/admin-activity.js";
import { createAdminRoutinesRoutes } from "./routes/admin-routines.js";
import { createAdminChoresRoutes } from "./routes/admin-chores.js";
import { createAdminRewardsRoutes } from "./routes/admin-rewards.js";
import { createAdminApprovalsRoutes } from "./routes/admin-approvals.js";
import { createAdminLedgerRoutes } from "./routes/admin-ledger.js";
import { createAdminAssetsRoutes } from "./routes/admin-assets.js";
import { createAdminBackupRoutes } from "./routes/admin-backup.js";
import { createChildRoutes } from "./routes/child.js";
import { createSubmissionRoutes } from "./routes/submissions.js";
import { adminAuth } from "./middleware/adminAuth.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { createAuthService } from "./services/authService.js";
import { createSettingsService } from "./services/settingsService.js";
import { createActivityService } from "./services/activityService.js";
import { createRoutineService } from "./services/routineService.js";
import { createChoreService } from "./services/choreService.js";
import { createRewardService } from "./services/rewardService.js";
import { createApprovalService } from "./services/approvalService.js";
import { createPointsService } from "./services/pointsService.js";
import { createBadgeService } from "./services/badgeService.js";
import { createAssetService } from "./services/assetService.js";
import { createBackupService } from "./services/backupService.js";
import { createPushService } from "./services/pushService.js";
import { createAdminRoutineAnalyticsRoutes } from "./routes/admin-routine-analytics.js";
import { createRoutineAnalyticsService } from "./services/routineAnalyticsService.js";
import { createAdminChoreAnalyticsRoutes } from "./routes/admin-chore-analytics.js";
import { createChoreAnalyticsService } from "./services/choreAnalyticsService.js";
import { createAdminSystemHealthRoutes } from "./routes/admin-system-health.js";
import { createSystemHealthService } from "./services/systemHealthService.js";
import { createAdminRewardAnalyticsRoutes } from "./routes/admin-reward-analytics.js";
import { createRewardAnalyticsService } from "./services/rewardAnalyticsService.js";
import { createPushRoutes } from "./routes/push.js";
import type { AppConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db: Database.Database, config: AppConfig) {
  const app = express();

  // Trust proxy for Cloudflare Tunnel
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(requestLogger());

  // Static asset serving (before API routes, no auth required)
  app.use("/assets", express.static(path.resolve(config.dataDir, "assets"), { maxAge: "7d" }));

  const authService = createAuthService(db);
  const settingsService = createSettingsService(db);
  const activityService = createActivityService(db);
  const badgeService = createBadgeService(db);
  const pushService = createPushService(db, config.dataDir, config.publicOrigin);
  const routineService = createRoutineService(db, activityService, badgeService, pushService);
  const choreService = createChoreService(db, activityService, badgeService, pushService);
  const rewardService = createRewardService(db, activityService, pushService);
  const pointsService = createPointsService(db, activityService);
  const approvalService = createApprovalService(db, activityService, badgeService, pushService);
  const assetService = createAssetService(db, config.dataDir, activityService);
  const routineAnalyticsService = createRoutineAnalyticsService(db);
  const choreAnalyticsService = createChoreAnalyticsService(db);
  const systemHealthService = createSystemHealthService(db);
  const rewardAnalyticsService = createRewardAnalyticsService(db);
  const backupService = createBackupService(db, config.dataDir, config, activityService);

  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.use("/api/auth", createAuthRoutes(authService, config));

  app.use("/api", createChildRoutes(routineService, choreService, rewardService, pointsService, badgeService, activityService, settingsService));

  app.use("/api/push", createPushRoutes(pushService, authService, config));

  app.use("/api", createSubmissionRoutes(routineService, choreService, rewardService, settingsService));

  app.use("/api/admin", adminAuth(authService, config));
  app.use("/api/admin", createAdminSettingsRoutes(settingsService, authService, config));
  app.use("/api/admin", createAdminActivityRoutes(activityService));
  app.use("/api/admin", createAdminRoutinesRoutes(routineService));
  app.use("/api/admin", createAdminChoresRoutes(choreService));
  app.use("/api/admin", createAdminRewardsRoutes(rewardService));
  app.use("/api/admin", createAdminApprovalsRoutes(approvalService));
  app.use("/api/admin", createAdminLedgerRoutes(pointsService, settingsService));
  app.use("/api/admin", createAdminAssetsRoutes(assetService, config.dataDir, config.imageGenApiKey));
  app.use("/api/admin", createAdminRoutineAnalyticsRoutes(routineAnalyticsService, settingsService));
  app.use("/api/admin", createAdminChoreAnalyticsRoutes(choreAnalyticsService, settingsService));
  app.use("/api/admin", createAdminSystemHealthRoutes(systemHealthService));
  app.use("/api/admin", createAdminRewardAnalyticsRoutes(rewardAnalyticsService));
  app.use("/api/admin", createAdminBackupRoutes(backupService, config.dataDir));

  app.all("/api/*", (_req, _res, next) => {
    next(new NotFoundError("API endpoint not found"));
  });

  const clientDist = config.clientDistDir ?? path.resolve(__dirname, "../../client/dist");

  // iOS PWAs always launch from the manifest's start_url, so we serve a
  // dynamic manifest that lets admin pages set start_url=/admin via query param.
  const ALLOWED_START_URLS = new Set(["/", "/today", "/admin"]);
  let cachedManifest: Record<string, unknown> | null = null;

  app.get("/manifest.json", (req, res, next) => {
    try {
      if (!cachedManifest) {
        const manifestPath = path.join(clientDist, "manifest.json");
        if (!fs.existsSync(manifestPath)) {
          return next();
        }
        cachedManifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      }

      const requestedStartUrl = typeof req.query.start_url === "string"
        ? req.query.start_url
        : null;

      const startUrl = requestedStartUrl && ALLOWED_START_URLS.has(requestedStartUrl)
        ? requestedStartUrl
        : cachedManifest!.start_url ?? "/";

      res.json({ ...cachedManifest, start_url: startUrl });
    } catch (err) {
      next(err);
    }
  });

  app.use(express.static(clientDist));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
