import { test, expect, type Page } from "@playwright/test";

test.describe("Offline UX", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto("/today");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test.afterAll(async () => {
    await page.context().setOffline(false);
    await page.close();
  });

  test("offline banner appears when network is disabled", async () => {
    await expect(page.getByRole("status")).not.toBeVisible();

    await page.context().setOffline(true);

    // Trigger the browser's offline event
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("offline");
  });

  test("banner disappears after going back online", async () => {
    await expect(page.getByRole("status")).toBeVisible();

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect(page.getByRole("status")).not.toBeVisible();
  });

  test("submit buttons are disabled while offline", async () => {
    await page.goto("/rewards");
    await expect(page.getByRole("heading", { name: "Rewards" })).toBeVisible();

    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await expect(page.getByRole("status")).toBeVisible();

    const requestButtons = page.getByRole("button", { name: /request/i });
    const count = await requestButtons.count();
    for (let i = 0; i < count; i++) {
      await expect(requestButtons.nth(i)).toBeDisabled();
    }

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect(page.getByRole("status")).not.toBeVisible();
  });

  test("offline banner reappears on second disconnect", async () => {
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));

    await expect(page.getByRole("status")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("offline");

    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect(page.getByRole("status")).not.toBeVisible();
  });
});
