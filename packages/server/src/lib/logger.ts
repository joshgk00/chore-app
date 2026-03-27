import pino from "pino";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
const VALID_LEVELS = new Set(Object.keys(pino.levels.values));

export interface LoggerConfig {
  level: string;
  logDir?: string;
  maxFileSize?: string;
  maxFiles?: number;
}

let logger: pino.Logger = pino({ level: "info" });
let fileStream: ReturnType<typeof pino.destination> | null = null;
let rotationTimer: ReturnType<typeof setInterval> | null = null;
let activeLogDir: string | undefined;
let activeMaxFileSize = 0;
let activeMaxFiles = DEFAULT_MAX_FILES;

function parseFileSize(value: string): number {
  const match = value.match(/^(\d+)\s*([kmg])?b?$/i);
  if (!match) {
    throw new Error(`Invalid LOG_MAX_SIZE "${value}". Use a number with optional k/m/g suffix (e.g., "10m", "500k").`);
  }

  const num = parseInt(match[1], 10);
  const unit = (match[2] || "").toLowerCase();

  switch (unit) {
    case "k":
      return num * 1024;
    case "m":
      return num * 1024 * 1024;
    case "g":
      return num * 1024 * 1024 * 1024;
    default:
      return num;
  }
}

function getLogFilePath(logDir: string): string {
  return path.join(logDir, "app.log");
}

function cleanOldLogs(logDir: string, maxFiles: number): void {
  try {
    const files = fs
      .readdirSync(logDir)
      .filter((f) => f.startsWith("app-") && f.endsWith(".log"))
      .sort()
      .reverse();

    for (const file of files.slice(maxFiles)) {
      fs.unlinkSync(path.join(logDir, file));
    }
  } catch {
    // Best effort cleanup
  }
}

function rotateIfNeeded(): void {
  if (!activeLogDir || !fileStream) return;

  const logFile = getLogFilePath(activeLogDir);

  try {
    const stats = fs.statSync(logFile);
    if (stats.size < activeMaxFileSize) return;

    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
    const rotatedPath = path.join(activeLogDir, `app-${timestamp}.log`);

    fs.renameSync(logFile, rotatedPath);
    fileStream.reopen();

    cleanOldLogs(activeLogDir, activeMaxFiles);
  } catch {
    // Rotation failure is non-fatal
  }
}

export function initLogger(config: LoggerConfig): pino.Logger {
  if (!VALID_LEVELS.has(config.level)) {
    throw new Error(`Invalid LOG_LEVEL "${config.level}". Valid levels: ${[...VALID_LEVELS].join(", ")}`);
  }

  if (!config.logDir) {
    logger = pino({ level: config.level });
    return logger;
  }

  fs.mkdirSync(config.logDir, { recursive: true });

  activeLogDir = config.logDir;
  activeMaxFileSize = config.maxFileSize ? parseFileSize(config.maxFileSize) : DEFAULT_MAX_FILE_SIZE;
  activeMaxFiles = config.maxFiles ?? DEFAULT_MAX_FILES;

  const logFile = getLogFilePath(config.logDir);
  fileStream = pino.destination({ dest: logFile, sync: false });

  logger = pino(
    { level: config.level },
    pino.multistream([
      { stream: process.stdout, level: config.level as pino.Level },
      { stream: fileStream, level: config.level as pino.Level },
    ]),
  );

  rotationTimer = setInterval(rotateIfNeeded, 60_000);
  rotationTimer.unref();

  return logger;
}

export function getLogger(): pino.Logger {
  return logger;
}

export function flushLogger(): void {
  try {
    fileStream?.flushSync();
  } catch {
    // Stream may not be ready yet during early shutdown
  }
}

export function shutdownLogger(): void {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  flushLogger();
}
