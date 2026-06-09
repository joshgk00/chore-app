import { test, expect, type Locator, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

const TEST_RUN_SUFFIX = Date.now();

function getRoutineRow(page: Page, name: string) {
  return page.locator("tr", { hasText: name });
}

async function getRoutineIdFromRow(row: Locator, name: string) {
  const href = await row.getByRole("link", { name, exact: true }).getAttribute("href");
  const routineId = href?.match(/\/admin\/routines\/(\d+)\/edit/)?.[1];
  if (!routineId) {
    throw new Error(`Could not read routine id from href: ${href ?? "<missing>"}`);
  }
  return routineId;
}

async function createRoutineWithItems(
  page: Page,
  name: string,
  items: string[],
) {
  await paceForRateLimiter(page);
  await page.goto("/admin/routines/new");
  await expect(page.getByRole("heading", { name: "New Routine" })).toBeVisible();

  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Points").fill("");
  await page.getByLabel("Points").fill("11");

  for (const [index, item] of items.entries()) {
    if (index > 0) {
      await page.getByRole("button", { name: "+ Add Item" }).first().click();
    }
    await page.getByLabel(`Checklist item ${index + 1}`).fill(item);
  }

  await paceForRateLimiter(page);
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/admin/routines") &&
        resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Save & Close" }).click(),
  ]);
  await page.waitForURL(/\/admin\/routines$/);
  await expect(getRoutineRow(page, name)).toBeVisible();
}

async function getAdminRoutine(page: Page, routineId: string) {
  const response = await page.request.get(`/api/admin/routines/${routineId}`);
  expect(response.ok(), `GET routine ${routineId} failed`).toBe(true);
  const body = await response.json();
  return body.data as {
    name: string;
    items: { label: string; archivedAt?: string }[];
  };
}

test.describe("Clone routine", () => {
  test("clones a routine as an editable draft without changing the source", async ({ page }) => {
    await loginAsAdmin(page);

    const sourceName = `School Source ${TEST_RUN_SUFFIX}`;
    const cloneName = `Camp Clone ${TEST_RUN_SUFFIX}`;
    const sourceItems = ["Pack backpack", "Fill water bottle", "Put shoes on"];

    await createRoutineWithItems(page, sourceName, sourceItems);

    const sourceRow = getRoutineRow(page, sourceName);
    const sourceId = await getRoutineIdFromRow(sourceRow, sourceName);

    await paceForRateLimiter(page);
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/admin/routines/${sourceId}`) &&
          resp.request().method() === "GET",
      ),
      sourceRow.getByRole("link", { name: `Clone ${sourceName}` }).click(),
    ]);

    await expect(page.getByRole("heading", { name: "Clone Routine" })).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveValue(`${sourceName} (Copy)`);
    await expect(page.getByLabel("Checklist item 1")).toHaveValue(sourceItems[0]);
    await expect(page.getByLabel("Checklist item 2")).toHaveValue(sourceItems[1]);
    await expect(page.getByLabel("Checklist item 3")).toHaveValue(sourceItems[2]);

    await page.getByRole("button", { name: "Remove item 2" }).click();
    await page.getByRole("button", { name: "+ Add Item" }).first().click();
    await page.getByLabel("Checklist item 3").fill("Grab swimsuit");
    await page.getByLabel("Name").fill(cloneName);

    await paceForRateLimiter(page);
    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/admin/routines") &&
          resp.request().method() === "POST",
      ),
      page.getByRole("button", { name: "Save & Close" }).click(),
    ]);
    await page.waitForURL(/\/admin\/routines$/);

    const cloneRow = getRoutineRow(page, cloneName);
    await expect(cloneRow).toBeVisible();
    await expect(sourceRow).toBeVisible();

    const cloneId = await getRoutineIdFromRow(cloneRow, cloneName);
    const cloneRoutine = await getAdminRoutine(page, cloneId);
    expect(cloneRoutine.name).toBe(cloneName);
    expect(cloneRoutine.items.filter((item) => !item.archivedAt).map((item) => item.label)).toEqual([
      "Pack backpack",
      "Put shoes on",
      "Grab swimsuit",
    ]);

    const sourceRoutine = await getAdminRoutine(page, sourceId);
    expect(sourceRoutine.name).toBe(sourceName);
    expect(sourceRoutine.items.filter((item) => !item.archivedAt).map((item) => item.label)).toEqual(sourceItems);
  });
});
