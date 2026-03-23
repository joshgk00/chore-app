import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";

const UNIQUE = Date.now();

async function createReward(page: Page, name: string, pointsCost: number) {
  await page.goto("/admin/rewards/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Points Cost").fill("");
  await page.getByLabel("Points Cost").fill(String(pointsCost));
  await page.getByRole("button", { name: "Create Reward" }).click();
  await page.waitForURL(/\/admin\/rewards$/);
  await expect(page.getByRole("link", { name })).toBeVisible();
}

function rewardRow(page: Page, name: string) {
  return page.locator("tr", { hasText: name });
}

// The submission rate limiter (10 req / 10 sec) is mounted at /api and
// accidentally catches admin routes. Pace requests to stay under the limit.
async function paceForRateLimiter(page: Page) {
  await page.waitForTimeout(5000);
}

async function archiveToggle(page: Page, row: ReturnType<typeof rewardRow>, action: "Archive" | "Unarchive") {
  await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/admin/rewards/") && resp.ok()),
    row.getByRole("button", { name: action }).click(),
  ]);
}

test.describe("Admin Rewards CRUD", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("create a reward and confirm it appears in list", async () => {
    const name = `Create Test ${UNIQUE}`;
    await createReward(page, name, 75);

    const row = rewardRow(page, name);
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "75" })).toBeVisible();
  });

  test("edit an existing reward and confirm changes persist", async () => {
    await paceForRateLimiter(page);

    const name = `Edit Me ${UNIQUE}`;
    const updated = `Updated ${UNIQUE}`;
    await createReward(page, name, 30);

    await page.getByRole("link", { name }).click();
    await page.waitForURL(/\/admin\/rewards\/\d+\/edit/);

    await expect(page.getByRole("heading", { name: "Edit Reward" })).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue(name);
    await expect(page.getByLabel("Points Cost")).toHaveValue("30");

    await page.getByLabel("Name").fill(updated);
    await page.getByLabel("Points Cost").fill("");
    await page.getByLabel("Points Cost").fill("55");

    await page.getByRole("button", { name: "Save Changes" }).click();
    await page.waitForURL(/\/admin\/rewards$/);

    const row = rewardRow(page, updated);
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "55" })).toBeVisible();
  });

  test("archive a reward shows Archived badge", async () => {
    await paceForRateLimiter(page);

    const name = `Archive Me ${UNIQUE}`;
    await createReward(page, name, 20);

    const row = rewardRow(page, name);
    await paceForRateLimiter(page);
    await archiveToggle(page, row, "Archive");

    await expect(row.getByText("Archived")).toBeVisible();
    await expect(row).toHaveClass(/opacity-60/);
  });

  test("archived reward is hidden from child rewards page", async () => {
    const response = await page.request.get("/api/rewards");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const names = body.data.map((r: { name: string }) => r.name);
    expect(names).not.toContain(`Archive Me ${UNIQUE}`);
  });

  test("unarchive a reward returns it to Active", async () => {
    await paceForRateLimiter(page);

    const name = `Unarchive Me ${UNIQUE}`;
    await createReward(page, name, 25);

    const row = rewardRow(page, name);
    await paceForRateLimiter(page);
    await archiveToggle(page, row, "Archive");
    await expect(row.getByText("Archived")).toBeVisible();

    await paceForRateLimiter(page);
    await archiveToggle(page, row, "Unarchive");
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row).not.toHaveClass(/opacity-60/);
  });

  test("archived reward cannot be edited (409 response)", async () => {
    await paceForRateLimiter(page);

    const name = `No Edit After Retire ${UNIQUE}`;
    await createReward(page, name, 10);

    const editLink = page.getByRole("link", { name });
    const href = await editLink.getAttribute("href");
    const rewardId = href?.match(/\/admin\/rewards\/(\d+)\/edit/)?.[1];
    expect(rewardId).toBeTruthy();

    const row = rewardRow(page, name);
    await paceForRateLimiter(page);
    await archiveToggle(page, row, "Archive");
    await expect(row.getByText("Archived")).toBeVisible();

    const response = await page.request.put(`/api/admin/rewards/${rewardId}`, {
      data: { name: "Attempted Edit" },
    });
    expect(response.status()).toBe(409);
  });

  test("submit button is disabled when offline", async () => {
    await page.goto("/admin/rewards/new");
    await expect(page.getByRole("heading", { name: "New Reward" })).toBeVisible();

    await page.getByLabel("Name").fill("Offline Test");
    await page.getByLabel("Points Cost").fill("");
    await page.getByLabel("Points Cost").fill("50");

    const submitButton = page.getByRole("button", { name: "Create Reward" });
    await expect(submitButton).toBeEnabled();

    await page.context().setOffline(true);
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
  });

  test("archive button is disabled when offline", async () => {
    await paceForRateLimiter(page);

    await page.goto("/admin/rewards");
    const firstArchiveBtn = page
      .locator("tr")
      .filter({ has: page.getByRole("button", { name: /Archive|Unarchive/ }) })
      .first()
      .getByRole("button", { name: /Archive|Unarchive/ });
    await expect(firstArchiveBtn).toBeVisible();
    await expect(firstArchiveBtn).toBeEnabled();

    await page.context().setOffline(true);
    await expect(firstArchiveBtn).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(firstArchiveBtn).toBeEnabled({ timeout: 5000 });
  });

  test("double-click on Create does not create duplicate rewards", async () => {
    await paceForRateLimiter(page);

    const name = `No Dupes ${UNIQUE}`;
    await page.goto("/admin/rewards/new");

    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Points Cost").fill("");
    await page.getByLabel("Points Cost").fill("40");

    const submitButton = page.getByRole("button", { name: "Create Reward" });
    await Promise.all([submitButton.click(), submitButton.click()]);

    await page.waitForURL(/\/admin\/rewards$/);
    await expect(page.getByRole("link", { name })).toHaveCount(1);
  });
});
