import { type Page, expect } from "@playwright/test";

const ADMIN_PIN = "123456";

export async function loginAsAdmin(page: Page) {
  await page.goto("/admin/pin");
  await page.getByPlaceholder("Enter PIN").fill(ADMIN_PIN);
  await page.getByRole("button", { name: "Unlock" }).click();
  await page.waitForURL(/\/admin/);
  await expect(page.locator("nav")).toBeVisible();
}
