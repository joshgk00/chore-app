import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

const ADMIN_PIN = process.env.INITIAL_ADMIN_PIN ?? "123456";

test.describe("Admin Settings", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("settings page loads with time slot and general sections", async () => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Time Slots" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "General" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Change PIN" }),
    ).toBeVisible();
  });

  test("save general settings and see confirmation", async () => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "General" }),
    ).toBeVisible({ timeout: 10000 });

    const timezoneInput = page.getByLabel("Timezone");
    await timezoneInput.fill("America/Chicago");

    const retentionInput = page.getByLabel("Activity retention (days)");
    await retentionInput.fill("");
    await retentionInput.fill("90");

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/admin/settings") &&
          resp.request().method() === "PUT" &&
          !resp.url().includes("/pin"),
      ),
      page.getByRole("button", { name: "Save General" }).click(),
    ]);

    expect(response.ok()).toBe(true);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  });

  test("save time slot settings and see confirmation", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Time Slots" }),
    ).toBeVisible({ timeout: 10000 });

    await page.locator("#morning-start").fill("06:00");
    await page.locator("#morning-end").fill("11:00");
    await page.locator("#afternoon-start").fill("12:00");
    await page.locator("#afternoon-end").fill("17:00");
    await page.locator("#bedtime-start").fill("19:00");
    await page.locator("#bedtime-end").fill("21:00");

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/admin/settings") &&
          resp.request().method() === "PUT" &&
          !resp.url().includes("/pin"),
      ),
      page.getByRole("button", { name: "Save Time Slots" }).click(),
    ]);

    expect(response.ok()).toBe(true);
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 5000 });
  });

  test("PIN change validation requires all fields", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Change PIN" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByRole("button", { name: "Change PIN" }).click();

    await expect(page.getByText("Current PIN is required")).toBeVisible();
    await expect(page.getByText("New PIN is required")).toBeVisible();
  });

  test("PIN change with mismatched confirmation shows error", async () => {
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Change PIN" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Current PIN").fill(ADMIN_PIN);
    await page.getByLabel("New PIN", { exact: true }).fill("654321");
    await page.getByLabel("Confirm new PIN").fill("999999");

    await page.getByRole("button", { name: "Change PIN" }).click();

    await expect(page.getByText("PINs do not match")).toBeVisible();
  });

  test("change PIN, verify old PIN rejected, new PIN works, then restore", async () => {
    await paceForRateLimiter(page);
    const newPin = "654321";

    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Change PIN" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Current PIN").fill(ADMIN_PIN);
    await page.getByLabel("New PIN", { exact: true }).fill(newPin);
    await page.getByLabel("Confirm new PIN").fill(newPin);

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/settings/pin"),
      ),
      page.getByRole("button", { name: "Change PIN" }).click(),
    ]);

    // Session invalidated — should redirect to PIN entry
    await page.waitForURL(/\/admin\/pin/, { timeout: 10000 });

    await page.getByPlaceholder("Enter PIN").fill(ADMIN_PIN);
    await page.getByRole("button", { name: "Unlock" }).click();
    await expect(
      page.getByText(/invalid/i).or(page.getByText(/incorrect/i)),
    ).toBeVisible({ timeout: 5000 });

    await paceForRateLimiter(page);

    await page.getByPlaceholder("Enter PIN").fill(newPin);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await expect(page.locator("nav")).toBeVisible();

    await paceForRateLimiter(page);
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Change PIN" }),
    ).toBeVisible({ timeout: 10000 });

    await page.getByLabel("Current PIN").fill(newPin);
    await page.getByLabel("New PIN", { exact: true }).fill(ADMIN_PIN);
    await page.getByLabel("Confirm new PIN").fill(ADMIN_PIN);

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/settings/pin"),
      ),
      page.getByRole("button", { name: "Change PIN" }).click(),
    ]);

    await page.waitForURL(/\/admin\/pin/, { timeout: 10000 });

    await page.getByPlaceholder("Enter PIN").fill(ADMIN_PIN);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForURL(/\/admin/, { timeout: 10000 });
    await expect(page.locator("nav")).toBeVisible();
  });

  test("save buttons are disabled when offline", async () => {
    await paceForRateLimiter(page);
    await page.goto("/admin/settings");
    await expect(
      page.getByRole("heading", { name: "Settings" }),
    ).toBeVisible({ timeout: 10000 });

    const saveTimeSlots = page.getByRole("button", { name: "Save Time Slots" });
    const saveGeneral = page.getByRole("button", { name: "Save General" });
    const changePin = page.getByRole("button", { name: "Change PIN" });

    await expect(saveTimeSlots).toBeEnabled();
    await expect(saveGeneral).toBeEnabled();
    await expect(changePin).toBeEnabled();

    await page.context().setOffline(true);
    await expect(saveTimeSlots).toBeDisabled({ timeout: 5000 });
    await expect(saveGeneral).toBeDisabled({ timeout: 5000 });
    await expect(changePin).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(saveTimeSlots).toBeEnabled({ timeout: 5000 });
    await expect(saveGeneral).toBeEnabled({ timeout: 5000 });
    await expect(changePin).toBeEnabled({ timeout: 5000 });
  });
});
