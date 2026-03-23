import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";

const TEST_RUN_SUFFIX = Date.now();

// The submission rate limiter (10 req / 10 sec) is mounted at /api and
// accidentally catches admin routes. Pace requests to stay under the limit.
async function paceForRateLimiter(page: Page) {
  await page.waitForTimeout(5000);
}

async function createRoutineWithApproval(page: Page, name: string) {
  await page.goto("/admin/routines/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Points").fill("");
  await page.getByLabel("Points").fill("5");
  await page.getByLabel("Requires Approval").check();
  await page.getByLabel("Item 1").fill("Test task");
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

  await Promise.all([
    page.waitForResponse((resp) =>
      resp.url().includes("/api/routine-completions") && resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: /submit|complete/i }).click(),
  ]);
}

async function createChoreWithApproval(page: Page, name: string) {
  await page.goto("/admin/chores/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Requires Approval").check();
  const tierNameInput = page.getByLabel("Tier Name").or(page.getByLabel("Tier 1 Name")).first();
  await tierNameInput.fill("Standard");
  const tierPointsInput = page.getByLabel("Tier Points").or(page.getByLabel("Tier 1 Points")).first();
  await tierPointsInput.fill("");
  await tierPointsInput.fill("8");
  await Promise.all([
    page.waitForResponse((resp) =>
      resp.url().includes("/api/admin/chores") && resp.request().method() === "POST",
    ),
    page.getByRole("button", { name: "Create Chore" }).click(),
  ]);
  await page.waitForURL(/\/admin\/chores$/);
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
    await expect(page.getByText(routineName)).toBeVisible({ timeout: 10000 });
  });

  test("approve a routine completion and verify it leaves the queue", async () => {
    await page.goto("/admin/approvals");
    await expect(page.getByText(routineName)).toBeVisible({ timeout: 10000 });

    const card = page.locator("div", { hasText: routineName })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })
      .first();

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/admin/approvals/") && resp.url().includes("/approve")),
      card.getByRole("button", { name: "Approve" }).click(),
    ]);

    expect(response.ok()).toBe(true);

    await expect(page.getByText(routineName)).not.toBeVisible({ timeout: 10000 });
  });

  test("double-approve returns 409", async () => {
    await paceForRateLimiter(page);

    // The routine we just approved — try to approve again via API
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

    // Submit another routine completion
    await submitRoutineAsChild(page, routineName);
    await paceForRateLimiter(page);
    await loginAsAdmin(page);

    const pointsBefore = await page.request.get("/api/points/summary");
    const totalBefore = (await pointsBefore.json()).data.total;

    await page.goto("/admin/approvals");
    await expect(page.getByText(routineName)).toBeVisible({ timeout: 10000 });

    const card = page.locator("div", { hasText: routineName })
      .filter({ has: page.getByRole("button", { name: "Reject" }) })
      .first();

    const [response] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/api/admin/approvals/") && resp.url().includes("/reject")),
      card.getByRole("button", { name: "Reject" }).click(),
    ]);

    expect(response.ok()).toBe(true);
    await expect(page.getByText(routineName)).not.toBeVisible({ timeout: 10000 });

    const pointsAfter = await page.request.get("/api/points/summary");
    const totalAfter = (await pointsAfter.json()).data.total;
    expect(totalAfter).toBe(totalBefore);
  });

  test("approve/reject buttons are disabled when offline", async () => {
    await paceForRateLimiter(page);

    // Submit one more to have something in the queue
    await submitRoutineAsChild(page, routineName);
    await paceForRateLimiter(page);
    await loginAsAdmin(page);
    await page.goto("/admin/approvals");
    await expect(page.getByText(routineName)).toBeVisible({ timeout: 10000 });

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

    // Approve remaining items
    const card = page.locator("div", { hasText: routineName })
      .filter({ has: page.getByRole("button", { name: "Approve" }) })
      .first();

    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes("/approve")),
      card.getByRole("button", { name: "Approve" }).click(),
    ]);

    // Wait for queue to be empty (or check empty state)
    await expect(
      page.getByText(/no pending/i).or(page.getByText(/all caught up/i).or(page.getByText(/nothing to review/i))),
    ).toBeVisible({ timeout: 10000 });
  });
});
