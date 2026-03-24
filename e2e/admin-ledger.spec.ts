import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";

const TEST_RUN_SUFFIX = Date.now();

async function paceForRateLimiter(page: Page) {
  await page.waitForTimeout(5000);
}

test.describe("Admin Points Ledger", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("ledger page loads with balance header", async () => {
    await page.goto("/admin/ledger");
    await expect(page.getByRole("heading", { name: "Points Ledger" })).toBeVisible();
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Reserved")).toBeVisible();
    await expect(page.getByText("Available")).toBeVisible();
  });

  test("create a positive manual adjustment", async () => {
    await page.goto("/admin/ledger");
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10000 });

    const adjustmentNote = `Bonus points ${TEST_RUN_SUFFIX}`;
    await page.getByLabel("Amount").fill("25");
    await page.getByLabel("Note").fill(adjustmentNote);

    const [response] = await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/points/adjust") && resp.request().method() === "POST",
      ),
      page.getByRole("button", { name: /adjust/i }).click(),
    ]);

    expect(response.status()).toBe(201);

    await expect(page.getByText(adjustmentNote)).toBeVisible({ timeout: 10000 });
  });

  test("balance updates after positive adjustment", async () => {
    const pointsRes = await page.request.get("/api/points/summary");
    expect(pointsRes.ok()).toBe(true);
    const points = await pointsRes.json();
    expect(points.data.total).toBeGreaterThanOrEqual(25);
  });

  test("create a negative manual adjustment", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/ledger");
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10000 });

    const adjustmentNote = `Deduction ${TEST_RUN_SUFFIX}`;
    await page.getByLabel("Amount").fill("-10");
    await page.getByLabel("Note").fill(adjustmentNote);

    const [response] = await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/points/adjust") && resp.request().method() === "POST",
      ),
      page.getByRole("button", { name: /adjust/i }).click(),
    ]);

    expect(response.status()).toBe(201);

    await expect(page.getByText(adjustmentNote)).toBeVisible({ timeout: 10000 });
  });

  test("adjustment without note shows validation error", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/ledger");
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Amount").fill("5");

    const submitButton = page.getByRole("button", { name: /adjust/i });
    await submitButton.click();

    // Expect client-side or server-side validation message
    await expect(
      page.getByText(/note.*required/i).or(page.getByText(/required/i)),
    ).toBeVisible({ timeout: 5000 });
  });

  test("entry type filter works", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/ledger");
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10000 });

    // Filter by manual entries
    const filterSelect = page.getByLabel(/filter|type/i);
    await filterSelect.selectOption("manual");

    await page.waitForResponse((resp) =>
      resp.url().includes("/api/admin/points/ledger") && resp.url().includes("entry_type=manual"),
    );

    // All visible entries should be manual type
    const entryTypes = page.locator("[data-entry-type]");
    const count = await entryTypes.count();
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        await expect(entryTypes.nth(i)).toHaveAttribute("data-entry-type", "manual");
      }
    }
  });

  test("adjust button is disabled when offline", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/ledger");
    await expect(page.getByText("Total")).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Amount").fill("5");
    await page.getByLabel("Note").fill("Offline test");

    const submitButton = page.getByRole("button", { name: /adjust/i });
    await expect(submitButton).toBeEnabled();

    await page.context().setOffline(true);
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
  });
});
