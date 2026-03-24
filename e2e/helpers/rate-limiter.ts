import type { Page } from "@playwright/test";

// The submission rate limiter (10 req / 10 sec window) is mounted at /api
// and accidentally catches admin routes. This fixed delay keeps sequential
// test actions under the limit. A proper fix would scope the limiter to
// submission-only POST endpoints or exempt admin routes entirely.
export async function paceForRateLimiter(page: Page) {
  await page.waitForTimeout(5000);
}
