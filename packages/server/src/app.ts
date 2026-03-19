import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { NotFoundError } from "./lib/errors.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { createAuthRoutes } from "./routes/auth.js";
import { adminAuth } from "./middleware/adminAuth.js";
import type { AppConfig } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(db: Database.Database, config: AppConfig) {
  const app = express();

  // Trust proxy for Cloudflare Tunnel
  app.set("trust proxy", 1);

  // Middleware
  app.use(express.json());
  app.use(cookieParser());

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ data: { status: "ok" } });
  });

  // Auth routes
  app.use("/api/auth", createAuthRoutes(db, config));

  // Admin routes (protected)
  app.use("/api/admin", adminAuth(db));

  // Placeholder admin settings route (will be expanded later)
  app.get("/api/admin/settings", (_req, res) => {
    const settings = db.prepare("SELECT key, value FROM settings").all() as Array<{
      key: string;
      value: string;
    }>;
    const settingsMap: Record<string, string> = {};
    for (const row of settings) {
      settingsMap[row.key] = row.value;
    }
    res.json({ data: settingsMap });
  });

  // API 404 handler
  app.all("/api/*", (_req, _res, next) => {
    next(new NotFoundError("API endpoint not found"));
  });

  // Static file serving for client
  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(express.static(clientDist));

  // SPA fallback for non-API routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
