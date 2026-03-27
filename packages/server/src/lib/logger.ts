import pino from "pino";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_MAX_FILES = 5;

export interface LoggerConfig {
  level: string;
  logDir?: string;
  maxFileSize: number;
  maxFiles?: number;
}

let logger: pino.Logger = pino({ level: "info" });
let fileStream: pino.DestinationStream | null = null;
let rotationTimer: ReturnType<typeof setInterval> | null = null;
let activeLogDir: string | undefined;
let activeMaxFileSize = 0;
let activeMaxFiles = DEFAULT_MAX_FILES;

export function parseFileSize(value: string): number {
  const match = value.match(/^(\d+)\s*([kmg])?b?$/i);
  if (!match) return 10 * 1024 * 1024;

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

    // SonicBoom reopens the file descriptor at the original path
    (fileStream as { reopen?: () => void }).reopen?.();

    cleanOldLogs(activeLogDir, activeMaxFiles);
  } catch {
    // Rotation failure is non-fatal
  }
}

export function initLogger(config: LoggerConfig): pino.Logger {
  if (!config.logDir) {
    logger = pino({ level: config.level });
    return logger;
  }

  fs.mkdirSync(config.logDir, { recursive: true });

  activeLogDir = config.logDir;
  activeMaxFileSize = config.maxFileSize;
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
  (fileStream as { flushSync?: () => void })?.flushSync?.();
}

export function shutdownLogger(): void {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
  }
  flushLogger();
}
