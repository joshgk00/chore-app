import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../../src/middleware/errorHandler.js';
import { AppError, AuthError, ValidationError, NotFoundError } from '../../src/lib/errors.js';

function mockReq(): Partial<Request> {
  return {};
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

const noop: NextFunction = () => {};

describe('errorHandler', () => {
  it('returns structured JSON for AuthError with 401 status', () => {
    const err = new AuthError('Admin authentication required');
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Admin authentication required',
      },
    });
  });

  it('returns 404 for NotFoundError', () => {
    const err = new NotFoundError('Resource not found');
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
    });
  });

  it('returns 422 with fieldErrors for ValidationError', () => {
    const err = new ValidationError('Invalid input', { pin: 'PIN must be 6 digits' });
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        fieldErrors: { pin: 'PIN must be 6 digits' },
      },
    });
  });

  it('omits fieldErrors key when ValidationError has no field errors', () => {
    const err = new ValidationError('Missing required fields');
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields',
      },
    });
  });

  it('returns 500 with generic message for unknown errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('database connection lost');
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    });
    expect(consoleSpy).toHaveBeenCalledWith('Unhandled error:', err);
    consoleSpy.mockRestore();
  });

  it('does not leak stack traces or internal details for unknown errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error('secret database password invalid');
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    const body = res.body as { error: { message: string; code: string } };
    expect(body.error.message).not.toContain('secret');
    expect(body.error.message).not.toContain('password');
    expect(body.error).not.toHaveProperty('stack');
    vi.restoreAllMocks();
  });

  it('returns structured response even for errors with no message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error();
    const res = mockRes();

    errorHandler(err, mockReq() as Request, res, noop);

    expect(res.statusCode).toBe(500);
    const body = res.body as { error: { code: string; message: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    vi.restoreAllMocks();
  });
});
