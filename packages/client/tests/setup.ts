import '@testing-library/jest-dom/vitest';
import { server } from './msw/server.js';

// Node 24's undici Request constructor rejects AbortSignal instances from the
// global scope when running under jsdom + MSW because of a realm mismatch.
// Strip the signal from RequestInit before delegating to the original
// constructor, then reattach it on the resulting Request object.
const OriginalRequest = globalThis.Request;
globalThis.Request = new Proxy(OriginalRequest, {
  construct(target, args, newTarget) {
    if (args[1] && typeof args[1] === 'object' && 'signal' in args[1]) {
      const { signal, ...rest } = args[1] as RequestInit & { signal?: AbortSignal };
      const req = Reflect.construct(target, [args[0], rest], newTarget);
      if (signal) {
        Object.defineProperty(req, 'signal', {
          value: signal,
          writable: false,
          enumerable: true,
          configurable: true,
        });
      }
      return req;
    }
    return Reflect.construct(target, args, newTarget);
  },
}) as unknown as typeof Request;

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
