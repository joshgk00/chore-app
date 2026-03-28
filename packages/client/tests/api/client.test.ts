import { describe, it, expect, vi, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { api, setOnAuthError } from '../../src/api/client.js';
import { server } from '../msw/server.js';

describe('api client', () => {
  describe('successful requests', () => {
    it('GET returns ok:true with parsed data', async () => {
      let capturedRequest: Request | undefined;
      server.use(
        http.get('/api/items', ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ data: { id: 1, name: 'test' } });
        }),
      );

      const result = await api.get<{ id: number; name: string }>('/api/items');

      expect(result).toEqual({ ok: true, data: { id: 1, name: 'test' } });
      expect(capturedRequest!.url).toContain('/api/items');
      expect(capturedRequest!.credentials).toBe('same-origin');
      expect(capturedRequest!.headers.get('Content-Type')).toBe('application/json');
    });

    it('POST sends JSON body and returns data', async () => {
      let capturedRequest: Request | undefined;
      server.use(
        http.post('/api/auth/verify', ({ request }) => {
          capturedRequest = request.clone();
          return HttpResponse.json({ data: { valid: true } });
        }),
      );

      const result = await api.post<{ valid: boolean }>('/api/auth/verify', { pin: '123456' });

      expect(result).toEqual({ ok: true, data: { valid: true } });
      expect(capturedRequest!.method).toBe('POST');
      const body = await capturedRequest!.json();
      expect(body).toEqual({ pin: '123456' });
    });

    it('PUT sends JSON body with PUT method', async () => {
      let capturedRequest: Request | undefined;
      server.use(
        http.put('/api/settings', ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ data: { updated: true } });
        }),
      );

      const result = await api.put<{ updated: boolean }>('/api/settings', { timezone: 'US/Pacific' });

      expect(result).toEqual({ ok: true, data: { updated: true } });
      expect(capturedRequest!.method).toBe('PUT');
    });

    it('DELETE sends DELETE method', async () => {
      let capturedRequest: Request | undefined;
      server.use(
        http.delete('/api/sessions', ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ data: null });
        }),
      );

      const result = await api.delete<null>('/api/sessions');

      expect(result).toEqual({ ok: true, data: null });
      expect(capturedRequest!.method).toBe('DELETE');
    });
  });

  describe('HTTP error responses', () => {
    it('returns ok:false with server error details on 401', async () => {
      server.use(
        http.post('/api/auth/verify', () =>
          HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
            { status: 401 },
          ),
        ),
      );

      const result = await api.post('/api/auth/verify', { pin: 'wrong' });

      expect(result).toEqual({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    });

    it('returns ok:false with server error details on 500', async () => {
      server.use(
        http.get('/api/health', () =>
          HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
            { status: 500 },
          ),
        ),
      );

      const result = await api.get('/api/health');

      expect(result).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
    });

    it('returns fallback error when response body has no error field', async () => {
      server.use(
        http.get('/api/missing', () => HttpResponse.json({}, { status: 400 })),
      );

      const result = await api.get('/api/missing');

      expect(result).toEqual({
        ok: false,
        error: { code: 'UNKNOWN', message: 'An unexpected error occurred' },
      });
    });
  });

  describe('network errors', () => {
    it('returns NETWORK_ERROR when fetch throws', async () => {
      server.use(
        http.get('/api/health', () => HttpResponse.error()),
      );

      const result = await api.get('/api/health');

      expect(result).toEqual({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: 'Unable to reach the server' },
      });
    });
  });

  describe('parse errors', () => {
    it('returns PARSE_ERROR when response JSON is invalid', async () => {
      server.use(
        http.get('/api/health', () =>
          new HttpResponse('invalid json{{{', {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      );

      const result = await api.get('/api/health');

      expect(result).toEqual({
        ok: false,
        error: { code: 'PARSE_ERROR', message: 'Received an invalid response from the server' },
      });
    });
  });

  describe('request configuration', () => {
    it('includes credentials:same-origin on all requests', async () => {
      let capturedRequest: Request | undefined;
      server.use(
        http.get('/api/test', ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ data: null });
        }),
      );

      await api.get('/api/test');

      expect(capturedRequest!.credentials).toBe('same-origin');
    });

    it('POST without body sends no body', async () => {
      let capturedRequest: Request | undefined;
      server.use(
        http.post('/api/auth/logout', ({ request }) => {
          capturedRequest = request;
          return HttpResponse.json({ data: null });
        }),
      );

      await api.post('/api/auth/logout');

      expect(capturedRequest!.body).toBeNull();
    });
  });

  describe('timeout', () => {
    it('returns NETWORK_ERROR when request exceeds timeout', async () => {
      vi.useFakeTimers();

      server.use(
        http.get('/api/slow', async () => {
          await new Promise((resolve) => setTimeout(resolve, 30_000));
          return HttpResponse.json({ data: null });
        }),
      );

      const resultPromise = api.get('/api/slow');
      await vi.advanceTimersByTimeAsync(11_000);
      const result = await resultPromise;

      expect(result).toEqual({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: 'Unable to reach the server' },
      });

      vi.useRealTimers();
    });
  });

  describe('auth error handler', () => {
    afterEach(() => {
      setOnAuthError(null);
    });

    it('calls onAuthError for 401 on admin endpoints', async () => {
      const handler = vi.fn();
      setOnAuthError(handler);

      server.use(
        http.get('/api/admin/chores', () =>
          HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Session expired' } },
            { status: 401 },
          ),
        ),
      );

      await api.get('/api/admin/chores');

      expect(handler).toHaveBeenCalledWith('/api/admin/chores');
    });

    it('does not call onAuthError for 401 on non-admin endpoints', async () => {
      const handler = vi.fn();
      setOnAuthError(handler);

      server.use(
        http.post('/api/auth/verify', () =>
          HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
            { status: 401 },
          ),
        ),
      );

      await api.post('/api/auth/verify', { pin: 'wrong' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not call onAuthError for non-401 errors on admin endpoints', async () => {
      const handler = vi.fn();
      setOnAuthError(handler);

      server.use(
        http.get('/api/admin/chores', () =>
          HttpResponse.json(
            { error: { code: 'INTERNAL_ERROR', message: 'Server error' } },
            { status: 500 },
          ),
        ),
      );

      await api.get('/api/admin/chores');

      expect(handler).not.toHaveBeenCalled();
    });

    it('still returns the error result when onAuthError is called', async () => {
      setOnAuthError(vi.fn());

      server.use(
        http.get('/api/admin/settings', () =>
          HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Session expired' } },
            { status: 401 },
          ),
        ),
      );

      const result = await api.get('/api/admin/settings');

      expect(result).toEqual({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Session expired' },
      });
    });

    it('does not throw when no onAuthError handler is set', async () => {
      server.use(
        http.get('/api/admin/chores', () =>
          HttpResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Session expired' } },
            { status: 401 },
          ),
        ),
      );

      const result = await api.get('/api/admin/chores');

      expect(result.ok).toBe(false);
    });
  });
});
