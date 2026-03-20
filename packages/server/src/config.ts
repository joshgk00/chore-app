export interface AppConfig {
  port: number;
  publicOrigin: string;
  dataDir: string;
  timezone: string;
  initialAdminPin: string;
  activityRetentionDays: number;
  imageGenApiKey?: string;
}

export function loadConfig(): AppConfig {
  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (!publicOrigin) {
    throw new Error(
      "PUBLIC_ORIGIN environment variable is required. Set it to the canonical HTTPS origin (e.g., https://chores.example.com).",
    );
  }

  const initialAdminPin = process.env.INITIAL_ADMIN_PIN || "123456";
  if (!process.env.INITIAL_ADMIN_PIN) {
    console.warn(
      "WARNING: INITIAL_ADMIN_PIN not set — using default PIN. Set this env var in production.",
    );
  }

  return {
    port: parseInt(process.env.PORT || "3000", 10),
    publicOrigin,
    dataDir: process.env.DATA_DIR || "./data",
    timezone: process.env.TZ || "America/New_York",
    initialAdminPin,
    activityRetentionDays: parseInt(process.env.ACTIVITY_RETENTION_DAYS_DEFAULT || "365", 10),
    imageGenApiKey: process.env.IMAGE_GEN_API_KEY,
  };
}
