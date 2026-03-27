import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

function mockRes(statusCode = 200) {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    statusCode,
    writableEnded: true,
    on(event: string, cb: () => void) {
      (listeners[event] ??= []).push(cb);
      return this;
    },
    _trigger(event: string) {
      for (const cb of listeners[event] ?? []) cb();
    },
  } as unknown as Response & { _trigger: (event: string) => void; writableEnded: boolean };
}

describe("requestLogger", () => {
  let mockInfo: ReturnType<typeof vi.fn>;
  let mockWarn: ReturnType<typeof vi.fn>;
  let mockError: ReturnType<typeof vi.fn>;

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips logging for health check endpoint", () => {
    const middleware = requestLogger();
    const req = mockReq({ path: "/api/health" });
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it("logs info for successful requests", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes(200);
    const next = vi.fn();

    middleware(req, res, next);
    res._trigger("finish");

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
    const next = vi.fn();

    middleware(req, res, next);
    res._trigger("finish");

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
    const next = vi.fn();

    middleware(req, res, next);
    res._trigger("finish");

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
    const next = vi.fn();

    middleware(req, res, next);
    res._trigger("finish");

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.any(Number),
      }),
      "request completed",
    );
  });

  it("logs aborted requests when connection closes before response ends", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes(200);
    res.writableEnded = false;
    const next = vi.fn();

    middleware(req, res, next);
    res._trigger("close");

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        path: "/api/test",
        aborted: true,
      }),
      "request aborted",
    );
  });

  it("does not log abort when response completed normally", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes(200);
    res.writableEnded = true;
    const next = vi.fn();

    middleware(req, res, next);
    res._trigger("close");

    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("calls next() to continue the middleware chain", () => {
    const middleware = requestLogger();
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
