import type { Page } from "@playwright/test";

// The submission rate limiter (10 req / 10 sec) is mounted at /api and
// accidentally catches admin routes. Pace requests to stay under the limit.
export async function paceForRateLimiter(page: Page) {
  await page.waitForTimeout(5000);
}
