import { http, HttpResponse, type RequestHandler } from 'msw';

export const handlers: RequestHandler[] = [
  http.get('/api/auth/session', () =>
    HttpResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'No session' } },
      { status: 401 },
    ),
  ),
];
