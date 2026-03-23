import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { SESSION_COOKIE_NAME } from '@chore-app/shared';
import { adminAuth } from '../../src/middleware/adminAuth.js';
import type { AppConfig } from '../../src/config.js';
import type { AuthService } from '../../src/services/authService.js';

function createMockAuthService(overrides: Partial<AuthService> = {}): AuthService {
  return {
    verifyPin: vi.fn().mockResolvedValue(false),
    createSession: vi.fn().mockReturnValue({ token: 'tok', tokenHash: 'hash' }),
    validateSession: vi.fn().mockReturnValue(null),
    destroySession: vi.fn(),
    destroyAllSessions: vi.fn(),
    ...overrides,
  };
}

function mockReq(cookies: Record<string, string> = {}): Partial<Request> {
  return { cookies };
}

function mockRes(): Partial<Response> & { cookie: ReturnType<typeof vi.fn> } {
  return {
    cookie: vi.fn(),
  };
}

describe('adminAuth', () => {
  let mockAuthService: AuthService;
  const config: AppConfig = {
    port: 3000,
    publicOrigin: 'http://localhost:3000',
    dataDir: './data',
    timezone: 'America/New_York',
    initialAdminPin: '123456',
    activityRetentionDays: 365,
  };

  beforeEach(() => {
    mockAuthService = createMockAuthService();
  });

  it('calls next with AuthError when session cookie is missing', () => {
    const middleware = adminAuth(mockAuthService, config);
    const next = vi.fn();

    middleware(mockReq() as Request, mockRes() as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as Error;
    expect(err).toBeDefined();
    expect(err.message).toBe('Admin authentication required');
  });

  it('calls next with AuthError when validateSession returns null', () => {
    const middleware = adminAuth(mockAuthService, config);
    const next = vi.fn();
    const req = mockReq({ [SESSION_COOKIE_NAME]: 'invalid-token' });

    middleware(req as Request, mockRes() as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as Error;
    expect(err).toBeDefined();
    expect(err.message).toBe('Invalid or expired session');
  });

  it('calls next with no error when session is valid and refreshes the cookie', () => {
    mockAuthService = createMockAuthService({
      validateSession: vi.fn().mockReturnValue({ id: 1, tokenHash: 'abc123' }),
    });
    const middleware = adminAuth(mockAuthService, config);
    const next = vi.fn();
    const req = mockReq({ [SESSION_COOKIE_NAME]: 'valid-token' });
    const res = mockRes();

    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(res.cookie).toHaveBeenCalledWith(
      SESSION_COOKIE_NAME,
      'valid-token',
      expect.objectContaining({ path: '/api', maxAge: 600_000 }),
    );
  });

  it('passes token from cookie to validateSession', () => {
    mockAuthService = createMockAuthService({
      validateSession: vi.fn().mockReturnValue({ id: 1, tokenHash: 'abc123' }),
    });
    const middleware = adminAuth(mockAuthService, config);
    const next = vi.fn();
    const req = mockReq({ [SESSION_COOKIE_NAME]: 'my-session-token' });

    middleware(req as Request, mockRes() as Response, next);

    expect(mockAuthService.validateSession).toHaveBeenCalledWith('my-session-token');
  });

  it('calls next with error when validateSession throws', () => {
    mockAuthService = createMockAuthService({
      validateSession: vi.fn().mockImplementation(() => {
        throw new Error('DB connection failed');
      }),
    });
    const middleware = adminAuth(mockAuthService, config);
    const next = vi.fn();
    const req = mockReq({ [SESSION_COOKIE_NAME]: 'some-token' });

    middleware(req as Request, mockRes() as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as Error;
    expect(err.message).toBe('DB connection failed');
  });
});
