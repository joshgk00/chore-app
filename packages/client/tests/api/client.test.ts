import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from '../../src/api/client.js';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('api client', () => {
  describe('successful requests', () => {
    it('GET returns ok:true with parsed data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { id: 1, name: 'test' } }),
      });

      const result = await api.get<{ id: number; name: string }>('/api/items');

      expect(result).toEqual({ ok: true, data: { id: 1, name: 'test' } });
      expect(mockFetch).toHaveBeenCalledWith('/api/items', expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }));
    });

    it('POST sends JSON body and returns data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { valid: true } }),
      });

      const result = await api.post<{ valid: boolean }>('/api/auth/verify', { pin: '123456' });

      expect(result).toEqual({ ok: true, data: { valid: true } });
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(options.body).toBe(JSON.stringify({ pin: '123456' }));
    });

    it('PUT sends JSON body with PUT method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: { updated: true } }),
      });

      const result = await api.put<{ updated: boolean }>('/api/settings', { timezone: 'US/Pacific' });

      expect(result).toEqual({ ok: true, data: { updated: true } });
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PUT');
    });

    it('DELETE sends DELETE method', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      const result = await api.delete<null>('/api/sessions');

      expect(result).toEqual({ ok: true, data: null });
      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
    });
  });

  describe('HTTP error responses', () => {
    it('returns ok:false with server error details on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
        }),
      });

      const result = await api.post('/api/auth/verify', { pin: 'wrong' });

      expect(result).toEqual({
        ok: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
      });
    });

    it('returns ok:false with server error details on 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({
          error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        }),
      });

      const result = await api.get('/api/health');

      expect(result).toEqual({
        ok: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      });
    });

    it('returns fallback error when response body has no error field', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}),
      });

      const result = await api.get('/api/missing');

      expect(result).toEqual({
        ok: false,
        error: { code: 'UNKNOWN', message: 'An unexpected error occurred' },
      });
    });
  });

  describe('network errors', () => {
    it('returns NETWORK_ERROR when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await api.get('/api/health');

      expect(result).toEqual({
        ok: false,
        error: { code: 'NETWORK_ERROR', message: 'Unable to reach the server' },
      });
    });
  });

  describe('parse errors', () => {
    it('returns PARSE_ERROR when response JSON is invalid', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      });

      const result = await api.get('/api/health');

      expect(result).toEqual({
        ok: false,
        error: { code: 'PARSE_ERROR', message: 'Received an invalid response from the server' },
      });
    });
  });

  describe('request configuration', () => {
    it('includes credentials:same-origin on all requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      await api.get('/api/test');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.credentials).toBe('same-origin');
    });

    it('POST without data sends no body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      await api.post('/api/auth/logout');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBeUndefined();
    });
  });
});
