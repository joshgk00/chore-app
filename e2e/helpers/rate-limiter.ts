import type { Page } from "@playwright/test";

// The submission rate limiter (10 req / 10 sec window) is mounted at /api
// and accidentally catches admin routes. This helper tracks request
// timestamps and only waits when approaching the limit. A proper fix
// would scope the limiter to submission-only POST endpoints.

const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const paceTimestamps: number[] = [];

export async function paceForRateLimiter(page: Page) {
  const now = Date.now();

  // Drop timestamps outside the current window
  while (paceTimestamps.length > 0 && now - paceTimestamps[0] >= RATE_LIMIT_WINDOW_MS) {
    paceTimestamps.shift();
  }

  if (paceTimestamps.length < RATE_LIMIT_MAX_REQUESTS) {
    paceTimestamps.push(now);
    return;
  }

  // Wait until the oldest call falls out of the window
  const oldest = paceTimestamps[0];
  const waitMs = RATE_LIMIT_WINDOW_MS - (now - oldest);

  if (waitMs > 0) {
    await page.waitForTimeout(waitMs);
  }

  const afterWait = Date.now();
  while (paceTimestamps.length > 0 && afterWait - paceTimestamps[0] >= RATE_LIMIT_WINDOW_MS) {
    paceTimestamps.shift();
  }
  paceTimestamps.push(afterWait);
}
