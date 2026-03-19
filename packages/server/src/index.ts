import { loadConfig } from "./config.js";
import { openDatabase } from "./db/connection.js";
import { runMigrations } from "./db/migrate.js";
import { bootstrapSettings } from "./services/settingsService.js";
import { initVapidKeys } from "./services/pushService.js";
import { createApp } from "./app.js";

function main() {
  console.log("Starting Chore App server...");

  // 1. Load config
  const config = loadConfig();
  console.log(`Config loaded: port=${config.port}, origin=${config.publicOrigin}`);

  // 2. Open database
  const db = openDatabase(config.dataDir);
  console.log("Database opened.");

  // 3. Run migrations
  runMigrations(db);
  console.log("Migrations complete.");

  // 4. Bootstrap settings (first-boot seed)
  bootstrapSettings(db, config);

  // 5. Initialize VAPID keys
  initVapidKeys(config.dataDir, config.publicOrigin);
  console.log("VAPID keys initialized.");

  // 6. Create and start app
  const app = createApp(db, config);

  const server = app.listen(config.port, () => {
    console.log(`Server listening on port ${config.port}`);
    console.log(`Public origin: ${config.publicOrigin}`);
  });

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down...");
    server.close(() => {
      db.close();
      console.log("Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
