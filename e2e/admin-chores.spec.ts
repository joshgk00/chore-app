import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

const TEST_RUN_SUFFIX = Date.now();

async function createChore(
  page: Page,
  name: string,
  tierName = "Basic",
  tierPoints = 10,
) {
  await page.goto("/admin/chores/new");
  await page.getByLabel("Name", { exact: true }).fill(name);

  await page.getByLabel("Tier 1 name").fill(tierName);
  await page.getByLabel("Tier 1 points").fill("");
  await page.getByLabel("Tier 1 points").fill(String(tierPoints));

  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/admin/chores") &&
        resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create Chore" }).click(),
  ]);
  await page.waitForURL(/\/admin\/chores$/);
  await expect(page.getByRole("link", { name })).toBeVisible();
}

function getChoreRow(page: Page, name: string) {
  return page.locator("tr", { hasText: name });
}

async function toggleArchiveStatus(
  page: Page,
  row: ReturnType<typeof getChoreRow>,
  action: "Archive" | "Unarchive",
) {
  const [response] = await Promise.all([
    page.waitForResponse((resp) => resp.url().includes("/api/admin/chores/")),
    row.getByRole("button", { name: action }).click(),
  ]);
  expect(
    response.ok(),
    `${action} failed with status ${response.status()}`,
  ).toBe(true);
}

test.describe("Admin Chores CRUD", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("create a chore with tiers and confirm it appears in list", async () => {
    const name = `Create Chore ${TEST_RUN_SUFFIX}`;
    await createChore(page, name, "Quick Clean", 5);

    const row = getChoreRow(page, name);
    await expect(row).toBeVisible();
    await expect(row.getByText("1 tier")).toBeVisible();
  });

  test("edit an existing chore and confirm changes persist", async () => {
    await paceForRateLimiter(page);

    const name = `Edit Chore ${TEST_RUN_SUFFIX}`;
    const updatedName = `Updated Chore ${TEST_RUN_SUFFIX}`;
    await createChore(page, name, "Standard", 15);

    await page.getByRole("link", { name }).click();
    await page.waitForURL(/\/admin\/chores\/\d+\/edit/);

    await expect(
      page.getByRole("heading", { name: "Edit Chore" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);

    await page.getByLabel("Name", { exact: true }).fill(updatedName);

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/admin/chores/") &&
          resp.request().method() === "PUT",
      ),
      page.getByRole("button", { name: "Save Changes" }).click(),
    ]);
    await page.waitForURL(/\/admin\/chores$/);

    const row = getChoreRow(page, updatedName);
    await expect(row).toBeVisible();
  });

  test("archive a chore shows Archived badge", async () => {
    await paceForRateLimiter(page);

    const name = `Archive Chore ${TEST_RUN_SUFFIX}`;
    await createChore(page, name, "Tier A", 8);

    const row = getChoreRow(page, name);
    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Archive");

    await expect(row.getByText("Archived")).toBeVisible();
    await expect(row).toHaveClass(/opacity-60/);
  });

  test("archived chore is hidden from child chores page", async () => {
    const response = await page.request.get("/api/chores");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const names = body.data.map((c: { name: string }) => c.name);
    expect(names).not.toContain(`Archive Chore ${TEST_RUN_SUFFIX}`);
  });

  test("unarchive a chore returns it to Active", async () => {
    await paceForRateLimiter(page);

    const name = `Unarchive Chore ${TEST_RUN_SUFFIX}`;
    await createChore(page, name, "Tier B", 12);

    const row = getChoreRow(page, name);
    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Archive");
    await expect(row.getByText("Archived")).toBeVisible();

    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Unarchive");
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row).not.toHaveClass(/opacity-60/);
  });

  test("archived chore cannot be edited (409 response)", async () => {
    await paceForRateLimiter(page);

    const name = `No Edit After Archive ${TEST_RUN_SUFFIX}`;
    await createChore(page, name, "Tier X", 6);

    const editLink = page.getByRole("link", { name });
    const href = await editLink.getAttribute("href");
    const choreId = href?.match(/\/admin\/chores\/(\d+)\/edit/)?.[1];
    expect(choreId).toBeTruthy();

    const row = getChoreRow(page, name);
    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Archive");
    await expect(row.getByText("Archived")).toBeVisible();

    const response = await page.request.put(
      `/api/admin/chores/${choreId}`,
      { data: { name: "Attempted Edit" } },
    );
    expect(response.status()).toBe(409);
  });

  test("submit button is disabled when offline", async () => {
    await page.goto("/admin/chores/new");
    await expect(
      page.getByRole("heading", { name: "New Chore" }),
    ).toBeVisible();

    await page.getByLabel("Name", { exact: true }).fill("Offline Test");
    await page.getByLabel("Tier 1 name").fill("Basic");

    const submitButton = page.getByRole("button", { name: "Create Chore" });
    await expect(submitButton).toBeEnabled();

    await page.context().setOffline(true);
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
  });

  test("submitting with empty name shows validation error", async () => {
    await page.goto("/admin/chores/new");
    await page.getByLabel("Tier 1 name").fill("Basic");

    await page.getByRole("button", { name: "Create Chore" }).click();

    await expect(page.getByText(/name.*required/i)).toBeVisible({ timeout: 5000 });
  });

  test("double-click on Create does not create duplicate chores", async () => {
    await paceForRateLimiter(page);

    const name = `No Dupes Chore ${TEST_RUN_SUFFIX}`;
    await page.goto("/admin/chores/new");

    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Tier 1 name").fill("Basic");

    const submitButton = page.getByRole("button", { name: "Create Chore" });
    await Promise.all([
      page.waitForURL(/\/admin\/chores$/),
      submitButton.click({ clickCount: 2 }),
    ]);
    await expect(page.getByRole("link", { name })).toHaveCount(1);
  });

  test("archive button is disabled when offline", async () => {
    await paceForRateLimiter(page);

    await page.goto("/admin/chores");
    const firstArchiveButton = page
      .locator("tr")
      .filter({
        has: page.getByRole("button", { name: /Archive|Unarchive/ }),
      })
      .first()
      .getByRole("button", { name: /Archive|Unarchive/ });
    await expect(firstArchiveButton).toBeVisible();
    await expect(firstArchiveButton).toBeEnabled();

    await page.context().setOffline(true);
    await expect(firstArchiveButton).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(firstArchiveButton).toBeEnabled({ timeout: 5000 });
  });
});
