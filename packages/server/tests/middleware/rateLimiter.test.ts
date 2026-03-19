import { describe, it, expect, beforeEach } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimiter.js';
import type { Request, Response } from 'express';

function mockReq(ip = '127.0.0.1'): Partial<Request> {
  return { ip };
}

function mockRes(): Partial<Response> & { statusCode: number; body: unknown; headers: Record<string, string> } {
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
    set(key: string, value: string) {
      res.headers[key] = value;
      return res;
    },
  };
  return res as Partial<Response> & { statusCode: number; body: unknown; headers: Record<string, string> };
}

describe('rateLimiter', () => {
  let rateLimiter: ReturnType<typeof createRateLimiter>;

  beforeEach(() => {
    rateLimiter = createRateLimiter();
  });

  it('allows the first 5 requests from same IP', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordFailure('127.0.0.1');
    }

    const req = mockReq();
    const res = mockRes();
    let nextCalled = false;
    rateLimiter(req as Request, res as unknown as Response, () => {
      nextCalled = true;
    });

    // 5 failures recorded, the 6th request should be blocked
    expect(res.statusCode).toBe(429);
  });

  it('returns 429 after exceeding attempt limit', () => {
    const ip = '10.0.0.1';
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordFailure(ip);
    }

    const req = mockReq(ip);
    const res = mockRes();
    rateLimiter(req as Request, res as unknown as Response, () => {});

    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('tracks IPs independently', () => {
    for (let i = 0; i < 5; i++) {
      rateLimiter.recordFailure('10.0.0.1');
    }

    const req = mockReq('10.0.0.2');
    const res = mockRes();
    let nextCalled = false;
    rateLimiter(req as Request, res as unknown as Response, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });

  it('allows requests from a clean IP', () => {
    const req = mockReq('192.168.1.1');
    const res = mockRes();
    let nextCalled = false;
    rateLimiter(req as Request, res as unknown as Response, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
  });
});
