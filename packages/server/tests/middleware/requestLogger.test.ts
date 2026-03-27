import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestLogger } from "../../src/middleware/requestLogger.js";
import * as loggerModule from "../../src/lib/logger.js";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    path: "/api/test",
    method: "GET",
    ip: "127.0.0.1",
    ...overrides,
  } as Request;
}

function mockRes(statusCode = 200): Response & { _finishCallback: () => void } {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    statusCode,
    on(event: string, cb: () => void) {
      (listeners[event] ??= []).push(cb);
      return this;
    },
    get _finishCallback() {
      return listeners["finish"]?.[0] ?? (() => {});
    },
  } as unknown as Response & { _finishCallback: () => void };
}

describe("requestLogger", () => {
  let mockInfo: ReturnType<typeof vi.fn>;
  let mockWarn: ReturnType<typeof vi.fn>;
  let mockError: ReturnType<typeof vi.fn>;
  const next: NextFunction = vi.fn();

  beforeEach(() => {
    mockInfo = vi.fn();
    mockWarn = vi.fn();
    mockError = vi.fn();
    vi.spyOn(loggerModule, "getLogger").mockReturnValue({
      info: mockInfo,
      warn: mockWarn,
      error: mockError,
    } as unknown as ReturnType<typeof loggerModule.getLogger>);
  });

  it("skips logging for health check endpoint", () => {
    const middleware = requestLogger();
    const req = mockReq({ path: "/api/health" });
    const res = mockRes();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._finishCallback).toBeDefined();
  });

  it("logs info for successful requests", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes(200);

    middleware(req, res, next);
    res._finishCallback();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/test",
        status: 200,
      }),
      "request completed",
    );
  });

  it("logs warn for 4xx client errors", () => {
    const middleware = requestLogger();
    const req = mockReq({ method: "POST" });
    const res = mockRes(422);

    middleware(req, res, next);
    res._finishCallback();

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        status: 422,
      }),
      "request error",
    );
  });

  it("logs error for 5xx server errors", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes(500);

    middleware(req, res, next);
    res._finishCallback();

    expect(mockError).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 500,
      }),
      "request failed",
    );
  });

  it("includes duration in log data", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes(200);

    middleware(req, res, next);
    res._finishCallback();

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.any(Number),
      }),
      "request completed",
    );
  });

  it("calls next() to continue the middleware chain", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes();
    const nextFn = vi.fn();

    middleware(req, res, nextFn);

    expect(nextFn).toHaveBeenCalledOnce();
  });
});
