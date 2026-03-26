import { loadConfig } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { createSettingsService } from "./services/settingsService.js";
import { createApp } from "./app.js";
import { startRetentionJob, type RetentionJobHandle } from "./jobs/retentionJob.js";

const SHUTDOWN_TIMEOUT_MS = 5_000;

async function main() {
  console.log("Starting Chore App server...");

  let db: ReturnType<typeof openDatabase> | null = null;
  let retentionJob: RetentionJobHandle | null = null;

  try {
    const config = loadConfig();
    console.log(`Config loaded: port=${config.port}, origin=${config.publicOrigin}`);

    db = openDatabase(config.dataDir);
    console.log("Database opened.");

    runMigrations(db);
    console.log("Migrations complete.");

    const settingsService = createSettingsService(db);
    await settingsService.bootstrapSettings(config);

    const app = createApp(db, config);
    console.log("App initialized.");

    retentionJob = startRetentionJob(db);

    const server = app.listen(config.port, () => {
      console.log(`Server listening on port ${config.port}`);
      console.log(`Public origin: ${config.publicOrigin}`);
    });

    const shutdown = () => {
      console.log("Shutting down...");

      const forceExit = setTimeout(() => {
        console.error("Graceful shutdown timed out, forcing exit.");
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);
      forceExit.unref();

      server.close(() => {
        retentionJob?.stop();
        db?.close();
        console.log("Server stopped.");
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
  console.error("Unhandled rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("Fatal: server failed to start", err);
  process.exit(1);
});
