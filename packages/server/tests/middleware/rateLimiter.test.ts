import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRateLimiter } from '../../src/middleware/rateLimiter.js';
import { COOLDOWN_ESCALATION_MINUTES } from '@chore-app/shared';
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
    rateLimiter._store.clear();
  });

  it('blocks requests once the failure limit is reached', () => {
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

  describe('cooldown escalation', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('escalates cooldown duration on repeated lockouts', () => {
      const ip = '10.0.0.50';

      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(ip);
      }
      const res1 = mockRes();
      rateLimiter(mockReq(ip) as Request, res1 as unknown as Response, () => {});
      expect(res1.statusCode).toBe(429);
      const firstRetryAfter = parseInt(res1.headers['Retry-After'], 10);
      expect(firstRetryAfter).toBe(COOLDOWN_ESCALATION_MINUTES[0] * 60);

      // Advance past first cooldown
      vi.advanceTimersByTime(COOLDOWN_ESCALATION_MINUTES[0] * 60 * 1000 + 1);

      // The middleware clears cooldown + attempts on the first request after expiry,
      // so make one request first to reset state, then accumulate new failures.
      const clearRes = mockRes();
      rateLimiter(mockReq(ip) as Request, clearRes as unknown as Response, () => {});

      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(ip);
      }
      const res2 = mockRes();
      rateLimiter(mockReq(ip) as Request, res2 as unknown as Response, () => {});
      expect(res2.statusCode).toBe(429);
      const secondRetryAfter = parseInt(res2.headers['Retry-After'], 10);
      expect(secondRetryAfter).toBe(COOLDOWN_ESCALATION_MINUTES[1] * 60);
    });

    it('allows requests after cooldown expires', () => {
      const ip = '10.0.0.60';

      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(ip);
      }
      const blockedRes = mockRes();
      rateLimiter(mockReq(ip) as Request, blockedRes as unknown as Response, () => {});
      expect(blockedRes.statusCode).toBe(429);

      // Advance past the cooldown period
      vi.advanceTimersByTime(COOLDOWN_ESCALATION_MINUTES[0] * 60 * 1000 + 1);

      let nextCalled = false;
      const allowedRes = mockRes();
      rateLimiter(mockReq(ip) as Request, allowedRes as unknown as Response, () => {
        nextCalled = true;
      });
      expect(nextCalled).toBe(true);
    });

    it('blocks requests during active cooldown', () => {
      const ip = '10.0.0.70';

      for (let i = 0; i < 5; i++) {
        rateLimiter.recordFailure(ip);
      }
      const firstRes = mockRes();
      rateLimiter(mockReq(ip) as Request, firstRes as unknown as Response, () => {});
      expect(firstRes.statusCode).toBe(429);

      // Advance only halfway through cooldown
      vi.advanceTimersByTime((COOLDOWN_ESCALATION_MINUTES[0] * 60 * 1000) / 2);

      const secondRes = mockRes();
      rateLimiter(mockReq(ip) as Request, secondRes as unknown as Response, () => {});
      expect(secondRes.statusCode).toBe(429);
    });
  });
});
