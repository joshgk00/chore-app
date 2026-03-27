import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { initLogger, getLogger, shutdownLogger } from "../../src/lib/logger.js";

function createTempLogDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "logger-test-"));
}

function removeTempDir(dir: string): void {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}

describe("initLogger", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    shutdownLogger();
    for (const dir of tempDirs) {
      removeTempDir(dir);
    }
    tempDirs.length = 0;
  });

  it("returns a pino logger instance", () => {
    const logger = initLogger({ level: "info" });
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("getLogger returns the initialized logger", () => {
    const logger = initLogger({ level: "info" });
    expect(getLogger()).toBe(logger);
  });

  it("throws on invalid log level", () => {
    expect(() => initLogger({ level: "verbose" })).toThrow(
      /Invalid LOG_LEVEL "verbose"/,
    );
  });

  it("accepts all valid pino log levels", () => {
    for (const level of ["trace", "debug", "info", "warn", "error", "fatal"]) {
      const logger = initLogger({ level });
      expect(logger.level).toBe(level);
      shutdownLogger();
    }
  });

  it("throws on invalid maxFileSize format", () => {
    const dir = createTempLogDir();
    tempDirs.push(dir);
    expect(() =>
      initLogger({ level: "info", logDir: dir, maxFileSize: "abc" }),
    ).toThrow(/Invalid LOG_MAX_SIZE "abc"/);
  });

  it("parses maxFileSize with k suffix", () => {
    const dir = createTempLogDir();
    tempDirs.push(dir);
    const logger = initLogger({ level: "info", logDir: dir, maxFileSize: "500k" });
    expect(logger).toBeDefined();
  });

  it("parses maxFileSize with m suffix", () => {
    const dir = createTempLogDir();
    tempDirs.push(dir);
    const logger = initLogger({ level: "info", logDir: dir, maxFileSize: "10m" });
    expect(logger).toBeDefined();
  });

  it("defaults maxFileSize to 10m when not specified", () => {
    const dir = createTempLogDir();
    tempDirs.push(dir);
    const logger = initLogger({ level: "info", logDir: dir });
    expect(logger).toBeDefined();
  });
});

describe("shutdownLogger", () => {
  it("can be called multiple times safely", () => {
    initLogger({ level: "info" });
    shutdownLogger();
    shutdownLogger();
  });

  it("can be called without prior initLogger", () => {
    // Default logger has no file stream, so this should not throw
    shutdownLogger();
  });
});
