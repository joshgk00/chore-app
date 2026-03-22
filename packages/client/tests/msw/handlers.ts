import { http, HttpResponse, type RequestHandler } from 'msw';

export const handlers: RequestHandler[] = [
  http.get('/api/auth/session', () =>
    HttpResponse.json({ data: { authenticated: false } }),
  ),
];
