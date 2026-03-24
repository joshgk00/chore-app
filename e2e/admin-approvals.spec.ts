import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

const TEST_RUN_SUFFIX = Date.now();

async function createRoutineWithApproval(page: Page, name: string) {
  await page.goto("/admin/routines/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Points").fill("");
  await page.getByLabel("Points").fill("5");
  await page.getByLabel("Completion Rule").selectOption("unlimited");
  await page.getByLabel("Requires Approval").check();
  await page.getByLabel("Checklist item 1").fill("Test task");
  await Promise.all([
    page.waitForResponse((resp) =>
      resp.url().includes("/api/admin/routines") && resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create Routine" }).click(),
  ]);
  await page.waitForURL(/\/admin\/routines$/);
}

async function submitRoutineAsChild(page: Page, routineName: string) {
  await page.goto("/routines");
  const routineLink = page.getByRole("link", { name: routineName });
  await expect(routineLink).toBeVisible({ timeout: 10000 });
  await routineLink.click();
  await page.waitForURL(/\/routines\/\d+/);

  const checkbox = page.getByRole("checkbox").first();
  await checkbox.click();

  const [response] = await Promise.all([
    page.waitForResponse((resp) =>
      resp.url().includes("/api/routine-completions") && resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: /submit|complete/i }).click(),
  ]);
  expect(response.ok(), `Submission failed with ${response.status()}`).toBe(true);
}

test.describe("Admin Approval Queue", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;
  const routineName = `Approval Routine ${TEST_RUN_SUFFIX}`;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("setup: create a routine that requires approval", async () => {
    await createRoutineWithApproval(page, routineName);
    await expect(page.getByRole("link", { name: routineName })).toBeVisible();
  });

  test("setup: submit the routine as a child", async () => {
    await paceForRateLimiter(page);
    await submitRoutineAsChild(page, routineName);
  });

  test("approval queue shows pending routine completion", async () => {
    await paceForRateLimiter(page);
    await loginAsAdmin(page);
    await page.goto("/admin/approvals");

    await expect(page.getByRole("heading", { name: "Approval Queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: routineName })).toBeVisible({ timeout: 10000 });
  });

  test("approve a routine completion and verify it leaves the queue", async () => {
    await page.goto("/admin/approvals");
    await expect(page.getByRole("heading", { name: routineName })).toBeVisible({ timeout: 10000 });

    const card = page.locator("div", { hasText: routineName })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })
      .first();

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/admin/approvals/") && resp.url().includes("/approve")),
      card.getByRole("button", { name: "Approve" }).click(),
    ]);

    expect(response.ok()).toBe(true);

    await expect(page.getByRole("heading", { name: routineName })).not.toBeVisible({ timeout: 10000 });
  });

  test("approved item no longer appears in pending queue", async () => {
    await paceForRateLimiter(page);

    const approvalsRes = await page.request.get("/api/admin/approvals");
    const body = await approvalsRes.json();
    const routineNames = body.data.routineCompletions.map((c: { routineNameSnapshot: string }) => c.routineNameSnapshot);
    expect(routineNames).not.toContain(routineName);
  });

  test("points increase after routine approval", async () => {
    const pointsRes = await page.request.get("/api/points/summary");
    expect(pointsRes.ok()).toBe(true);
    const points = await pointsRes.json();
    expect(points.data.total).toBeGreaterThan(0);
  });

  test("reject a routine completion and verify no points awarded", async () => {
    await paceForRateLimiter(page);

    await submitRoutineAsChild(page, routineName);
    await paceForRateLimiter(page);
    await loginAsAdmin(page);

    const pointsBefore = await page.request.get("/api/points/summary");
    const totalBefore = (await pointsBefore.json()).data.total;

    await page.goto("/admin/approvals");
    await expect(page.getByRole("heading", { name: routineName })).toBeVisible({ timeout: 10000 });

    const card = page.locator("div", { hasText: routineName })
      .filter({ has: page.getByRole("button", { name: "Reject" }) })
      .first();

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/admin/approvals/") && resp.url().includes("/reject")),
      card.getByRole("button", { name: "Reject" }).click(),
    ]);

    expect(response.ok()).toBe(true);
    await expect(page.getByRole("heading", { name: routineName })).not.toBeVisible({ timeout: 10000 });

    const pointsAfter = await page.request.get("/api/points/summary");
    const totalAfter = (await pointsAfter.json()).data.total;
    expect(totalAfter).toBe(totalBefore);
  });

  test("approve/reject buttons are disabled when offline", async () => {
    await paceForRateLimiter(page);

    await submitRoutineAsChild(page, routineName);
    await paceForRateLimiter(page);
    await loginAsAdmin(page);
    await page.goto("/admin/approvals");
    await expect(page.getByRole("heading", { name: routineName })).toBeVisible({ timeout: 10000 });

    const approveButton = page.getByRole("button", { name: "Approve" }).first();
    const rejectButton = page.getByRole("button", { name: "Reject" }).first();

    await expect(approveButton).toBeEnabled();
    await expect(rejectButton).toBeEnabled();

    await page.context().setOffline(true);
    await expect(approveButton).toBeDisabled({ timeout: 5000 });
    await expect(rejectButton).toBeDisabled({ timeout: 5000 });

    await page.context().setOffline(false);
    await expect(approveButton).toBeEnabled({ timeout: 5000 });
    await expect(rejectButton).toBeEnabled({ timeout: 5000 });
  });

  test("empty state shown when no pending approvals", async () => {
    await paceForRateLimiter(page);

    const card = page.locator("div", { hasText: routineName })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })
      .first();

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/approve")),
      card.getByRole("button", { name: "Approve" }).click(),
    ]);

    await expect(
      page.getByText("No pending approvals"),
    ).toBeVisible({ timeout: 10000 });
  });
});
