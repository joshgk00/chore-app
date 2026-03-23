import { describe, it, expect, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createSubmissionRateLimiter } from "../../src/middleware/submissionRateLimiter.js";
import { SUBMISSION_RATE_LIMIT_MAX } from "@chore-app/shared";

function mockReq(ip = "127.0.0.1"): Partial<Request> {
  return { ip };
}

function mockRes(): Partial<Response> & { statusCode: number; body: unknown } {
  const res: Partial<Response> & { statusCode: number; body: unknown } = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res as Response;
    },
    json(data: unknown) {
      res.body = data;
      return res as Response;
    },
  };
  return res;
}

describe("submissionRateLimiter", () => {
  let limiter: ReturnType<typeof createSubmissionRateLimiter>;

  beforeEach(() => {
    limiter = createSubmissionRateLimiter();
  });

  it("allows requests under the limit", () => {
    const req = mockReq();
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => { called = true; };

    limiter(req as Request, res as unknown as Response, next);
    expect(called).toBe(true);
  });

  it("returns 429 after exceeding the limit", () => {
    const req = mockReq();

    for (let i = 0; i < SUBMISSION_RATE_LIMIT_MAX; i++) {
      const res = mockRes();
      let called = false;
      const next: NextFunction = () => { called = true; };
      limiter(req as Request, res as unknown as Response, next);
      expect(called).toBe(true);
    }

    const res = mockRes();
    let called = false;
    const next: NextFunction = () => { called = true; };
    limiter(req as Request, res as unknown as Response, next);

    expect(called).toBe(false);
    expect(res.statusCode).toBe(429);
    expect((res.body as { error: { code: string } }).error.code).toBe("RATE_LIMITED");
  });

  it("tracks limits per IP independently", () => {
    for (let i = 0; i < SUBMISSION_RATE_LIMIT_MAX; i++) {
      const req = mockReq("1.1.1.1");
      const res = mockRes();
      limiter(req as Request, res as unknown as Response, () => {});
    }

    const req = mockReq("2.2.2.2");
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => { called = true; };
    limiter(req as Request, res as unknown as Response, next);

    expect(called).toBe(true);
  });

  it("exposes _store for inspection", () => {
    const req = mockReq();
    const res = mockRes();
    limiter(req as Request, res as unknown as Response, () => {});

    expect(limiter._store.size).toBe(1);
    expect(limiter._store.has("127.0.0.1")).toBe(true);
  });

  it("uses 'unknown' as key when req.ip is undefined", () => {
    const req = { ip: undefined } as unknown as Request;
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => { called = true; };

    limiter(req, res as unknown as Response, next);

    expect(called).toBe(true);
    expect(limiter._store.has("unknown")).toBe(true);
  });

  it("skips tracking when MAX_TRACKED_IPS is reached but still allows request", () => {
    for (let i = 0; i < 10_000; i++) {
      const req = mockReq(`10.0.${Math.floor(i / 256)}.${i % 256}`);
      const res = mockRes();
      limiter(req as Request, res as unknown as Response, () => {});
    }

    expect(limiter._store.size).toBe(10_000);

    const req = mockReq("99.99.99.99");
    const res = mockRes();
    let called = false;
    const next: NextFunction = () => { called = true; };
    limiter(req as Request, res as unknown as Response, next);

    expect(called).toBe(true);
    expect(limiter._store.has("99.99.99.99")).toBe(false);
  });
});
