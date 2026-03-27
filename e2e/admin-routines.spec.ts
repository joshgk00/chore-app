import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

const TEST_RUN_SUFFIX = Date.now();

async function createRoutine(page: Page, name: string, points = 5) {
  await page.goto("/admin/routines/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Points").fill("");
  await page.getByLabel("Points").fill(String(points));
  await page.getByLabel("Checklist item 1").fill("Test step one");
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/admin/routines") &&
        resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create Routine" }).click(),
  ]);
  await page.waitForURL(/\/admin\/routines$/);
  await expect(page.getByRole("link", { name })).toBeVisible();
}

function getRoutineRow(page: Page, name: string) {
  return page.locator("tr", { hasText: name });
}

async function toggleArchiveStatus(
  page: Page,
  row: ReturnType<typeof getRoutineRow>,
  action: "Archive" | "Unarchive",
) {
  const [response] = await Promise.all([
    page.waitForResponse((resp) =>
      resp.url().includes("/api/admin/routines/"),
    ),
    row.getByRole("button", { name: action }).click(),
  ]);
  expect(
    response.ok(),
    `${action} failed with status ${response.status()}`,
  ).toBe(true);
}

test.describe("Admin Routines CRUD", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("create a routine with checklist items and confirm it appears in list", async () => {
    const name = `Create Routine ${TEST_RUN_SUFFIX}`;
    await createRoutine(page, name, 10);

    const row = getRoutineRow(page, name);
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "10", exact: true })).toBeVisible();
  });

  test("edit an existing routine and confirm changes persist", async () => {
    await paceForRateLimiter(page);

    const name = `Edit Routine ${TEST_RUN_SUFFIX}`;
    const updatedName = `Updated Routine ${TEST_RUN_SUFFIX}`;
    await createRoutine(page, name, 5);

    await page.getByRole("link", { name }).click();
    await page.waitForURL(/\/admin\/routines\/\d+\/edit/);

    await expect(
      page.getByRole("heading", { name: "Edit Routine" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue(name);

    await page.getByLabel("Name").fill(updatedName);
    await page.getByLabel("Points").fill("");
    await page.getByLabel("Points").fill("15");

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/admin/routines/") &&
          resp.request().method() === "PUT",
      ),
      page.getByRole("button", { name: "Save Changes" }).click(),
    ]);
    await page.waitForURL(/\/admin\/routines$/);

    const row = getRoutineRow(page, updatedName);
    await expect(row).toBeVisible();
    await expect(row.getByRole("cell", { name: "15", exact: true })).toBeVisible();
  });

  test("archive a routine shows Archived badge", async () => {
    await paceForRateLimiter(page);

    const name = `Archive Routine ${TEST_RUN_SUFFIX}`;
    await createRoutine(page, name, 3);

    const row = getRoutineRow(page, name);
    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Archive");

    await expect(row.getByText("Archived")).toBeVisible();
    await expect(row).toHaveClass(/opacity-60/);
  });

  test("archived routine is hidden from child routines page", async () => {
    const response = await page.request.get("/api/routines");
    expect(response.ok()).toBe(true);
    const body = await response.json();
    const names = body.data.map((r: { name: string }) => r.name);
    expect(names).not.toContain(`Archive Routine ${TEST_RUN_SUFFIX}`);
  });

  test("unarchive a routine returns it to Active", async () => {
    await paceForRateLimiter(page);

    const name = `Unarchive Routine ${TEST_RUN_SUFFIX}`;
    await createRoutine(page, name, 7);

    const row = getRoutineRow(page, name);
    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Archive");
    await expect(row.getByText("Archived")).toBeVisible();

    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Unarchive");
    await expect(row.getByText("Active")).toBeVisible();
    await expect(row).not.toHaveClass(/opacity-60/);
  });

  test("archived routine cannot be edited (409 response)", async () => {
    await paceForRateLimiter(page);

    const name = `No Edit After Archive ${TEST_RUN_SUFFIX}`;
    await createRoutine(page, name, 4);

    const editLink = page.getByRole("link", { name });
    const href = await editLink.getAttribute("href");
    const routineId = href?.match(/\/admin\/routines\/(\d+)\/edit/)?.[1];
    expect(routineId).toBeTruthy();

    const row = getRoutineRow(page, name);
    await paceForRateLimiter(page);
    await toggleArchiveStatus(page, row, "Archive");
    await expect(row.getByText("Archived")).toBeVisible();

    const response = await page.request.put(
      `/api/admin/routines/${routineId}`,
      { data: { name: "Attempted Edit" } },
    );
    expect(response.status()).toBe(409);
  });

  test("submitting with empty name shows validation error", async () => {
    await page.goto("/admin/routines/new");
    await page.getByLabel("Checklist item 1").fill("Step one");

    await page.getByRole("button", { name: "Create Routine" }).click();

    await expect(page.getByText(/name.*required/i)).toBeVisible({ timeout: 5000 });
  });

  test("submit button is disabled when offline", async () => {
    await page.goto("/admin/routines/new");
    await expect(
      page.getByRole("heading", { name: "New Routine" }),
    ).toBeVisible();

    await page.getByLabel("Name").fill("Offline Test");
    await page.getByLabel("Checklist item 1").fill("Step one");

    const submitButton = page.getByRole("button", { name: "Create Routine" });
    await expect(submitButton).toBeEnabled();

    await page.context().setOffline(true);
    await expect(submitButton).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
  });

  test("archive button is disabled when offline", async () => {
    await paceForRateLimiter(page);

    await page.goto("/admin/routines");
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

  test("double-click on Create does not create duplicate routines", async () => {
    await paceForRateLimiter(page);

    const name = `No Dupes Routine ${TEST_RUN_SUFFIX}`;
    await page.goto("/admin/routines/new");

    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Checklist item 1").fill("Step one");

    const submitButton = page.getByRole("button", { name: "Create Routine" });
    await Promise.all([
      page.waitForURL(/\/admin\/routines$/),
      submitButton.click({ clickCount: 2 }),
    ]);
    await expect(page.getByRole("link", { name })).toHaveCount(1);
  });
});
