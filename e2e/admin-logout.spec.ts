import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

test.describe("Admin Logout", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("logout button is visible in admin nav", async () => {
    await page.goto("/admin");
    await expect(
      page.getByRole("button", { name: "Logout" }),
    ).toBeVisible();
  });

  test("clicking logout redirects to /today", async () => {
    await page.goto("/admin");
    await expect(page.locator("nav")).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await page.waitForURL(/\/today/, { timeout: 10000 });
  });

  test("after logout, admin routes redirect to PIN entry", async () => {
    await paceForRateLimiter(page);

    await page.goto("/admin/routines");
    await page.waitForURL(/\/admin\/pin/, { timeout: 10000 });
    await expect(page.getByPlaceholder("Enter PIN")).toBeVisible();
  });

  test("can log back in after logout", async () => {
    await paceForRateLimiter(page);
    await loginAsAdmin(page);
    await page.goto("/admin");
    await expect(page.locator("nav")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Logout" }),
    ).toBeVisible();
  });

  test("Exit Admin link navigates to /today without destroying session", async () => {
    await page.goto("/admin");
    await expect(page.locator("nav")).toBeVisible();

    await page.getByRole("link", { name: "Exit Admin" }).click();
    await page.waitForURL(/\/today/, { timeout: 10000 });

    await paceForRateLimiter(page);

    // Session should still be valid — admin route should work
    await page.goto("/admin/routines");
    await expect(
      page.getByRole("heading", { name: "Routines" }),
    ).toBeVisible({ timeout: 10000 });
  });
});
