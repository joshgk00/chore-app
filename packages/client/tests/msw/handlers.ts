import { type RequestHandler } from 'msw';

// No default handlers — individual tests configure responses via server.use()
export const handlers: RequestHandler[] = [];
