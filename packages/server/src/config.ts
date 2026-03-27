import fs from "node:fs";
import path from "node:path";

export interface AppConfig {
  port: number;
  publicOrigin: string;
  dataDir: string;
  timezone: string;
  initialAdminPin: string;
  activityRetentionDays: number;
  imageGenApiKey?: string;
  logDir?: string;
  logLevel?: string;
  logMaxSize?: string;
}

function findNearestEnvFile(startDir: string): string | null {
  let currentDir = path.resolve(startDir);
  let parentDir = path.dirname(currentDir);

  while (currentDir !== parentDir) {
    const envPath = path.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      return envPath;
    }

    currentDir = parentDir;
    parentDir = path.dirname(currentDir);
  }

  const rootEnvPath = path.join(currentDir, ".env");
  return fs.existsSync(rootEnvPath) ? rootEnvPath : null;
}

function parseEnvFile(contents: string): Record<string, string> {
  const entries: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/u)) {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const match = trimmedLine.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const commentIndex = value.indexOf(" #");
      if (commentIndex >= 0) {
        value = value.slice(0, commentIndex).trim();
      }
    }

    entries[key] = value;
  }

  return entries;
}

function loadLocalEnvFile(startDir: string): void {
  const envPath = findNearestEnvFile(startDir);
  if (!envPath) {
    return;
  }

  const envEntries = parseEnvFile(fs.readFileSync(envPath, "utf-8"));
  for (const [key, value] of Object.entries(envEntries)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

export function loadConfig(startDir = process.cwd()): AppConfig {
  loadLocalEnvFile(startDir);

  const publicOrigin = process.env.PUBLIC_ORIGIN;
  if (!publicOrigin) {
    throw new Error(
      "PUBLIC_ORIGIN environment variable is required. Set it to the canonical HTTPS origin (e.g., https://chores.example.com).",
    );
  }

  const initialAdminPin = process.env.INITIAL_ADMIN_PIN;
  if (!initialAdminPin) {
    throw new Error(
      "INITIAL_ADMIN_PIN environment variable is required. Set it to a PIN of at least 6 digits in your .env file or container environment.",
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
    logDir: process.env.LOG_DIR || undefined,
    logLevel: process.env.LOG_LEVEL || "info",
    logMaxSize: process.env.LOG_MAX_SIZE || "10m",
  };
}
