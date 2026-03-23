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
import { adminAuth } from "./middleware/adminAuth.js";
import { createAuthService } from "./services/authService.js";
import { createSettingsService } from "./services/settingsService.js";
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

  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  app.use("/api/auth", createAuthRoutes(authService, config));

  app.use("/api/admin", adminAuth(authService, config));
  app.use("/api/admin", createAdminRoutes(settingsService));

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
