import { loadConfig } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { createSettingsService } from "./services/settingsService.js";
import { createApp } from "./app.js";
import { startRetentionJob, type RetentionJobHandle } from "./jobs/retentionJob.js";
import { initLogger, getLogger, shutdownLogger } from "./lib/logger.js";

const SHUTDOWN_TIMEOUT_MS = 5_000;

async function main() {
  const config = loadConfig();

  initLogger({
    level: config.logLevel,
    logDir: config.logDir,
    maxFileSize: config.logMaxSize,
  });

  const log = getLogger();
  log.info({ port: config.port, origin: config.publicOrigin }, "starting server");

  let db: ReturnType<typeof openDatabase> | null = null;
  let retentionJob: RetentionJobHandle | null = null;

  try {
    db = openDatabase(config.dataDir);
    log.info("database opened");

    runMigrations(db);
    log.info("migrations complete");

    const settingsService = createSettingsService(db);
    await settingsService.bootstrapSettings(config);

    const app = createApp(db, config);
    log.info("app initialized");

    retentionJob = startRetentionJob(db);

    const server = app.listen(config.port, () => {
      log.info({ port: config.port, origin: config.publicOrigin }, "server listening");
    });

    const shutdown = () => {
      log.info("shutting down");

      const forceExit = setTimeout(() => {
        log.error("graceful shutdown timed out, forcing exit");
        shutdownLogger();
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceExit.unref();

      server.close(() => {
        retentionJob?.stop();
        db?.close();
        log.info("server stopped");
        shutdownLogger();
        process.exit(0);
      });
    };

    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
  } catch (err) {
    db?.close();
    throw err;
  }
}

process.on("unhandledRejection", (reason) => {
  getLogger().error({ err: reason }, "unhandled rejection");
  shutdownLogger();
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  getLogger().error({ err }, "uncaught exception");
  shutdownLogger();
  process.exit(1);
});

main().catch((err) => {
  getLogger().fatal({ err }, "server failed to start");
  shutdownLogger();
  process.exit(1);
});
