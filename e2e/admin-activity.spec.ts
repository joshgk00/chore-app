import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin-auth.js";
import { paceForRateLimiter } from "./helpers/rate-limiter.js";

const TEST_RUN_SUFFIX = Date.now();

test.describe("Admin Activity Log", () => {
  test.describe.configure({ mode: "serial" });

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginAsAdmin(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("activity log page loads with filters and table", async () => {
    await page.goto("/admin/activity");
    await expect(
      page.getByRole("heading", { name: "Activity Log" }),
    ).toBeVisible();
    await expect(page.getByLabel("Event type")).toBeVisible();
    await expect(page.getByLabel("Start date")).toBeVisible();
    await expect(page.getByLabel("End date")).toBeVisible();
  });

  test("generate activity by creating and submitting a routine", async () => {
    const routineName = `Activity Test ${TEST_RUN_SUFFIX}`;
    const createResp = await page.request.post("/api/admin/routines", {
      data: {
        name: routineName,
        timeSlot: "anytime",
        completionRule: "unlimited",
        points: 5,
        requiresApproval: false,
        randomizeItems: false,
        sortOrder: 0,
        items: [{ label: "Test task", sortOrder: 0 }],
      },
    });
    expect(createResp.ok()).toBe(true);
    const routine = (await createResp.json()).data;

    await paceForRateLimiter(page);

    await page.goto(`/routines/${routine.id}`);
    const checkbox = page.getByRole("checkbox").first();
    await expect(checkbox).toBeVisible({ timeout: 10000 });
    await checkbox.click();

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/routine-completions") &&
          resp.request().method() === "POST",
      ),
      page.getByRole("button", { name: /submit|complete/i }).click(),
    ]);

    await paceForRateLimiter(page);
  });

  test("activity log shows the submission event", async () => {
    await loginAsAdmin(page);
    await page.goto("/admin/activity");
    await expect(
      page.getByRole("heading", { name: "Activity Log" }),
    ).toBeVisible();

    const table = page.locator("table");
    await expect(
      table.or(page.getByText("No activity found")),
    ).toBeVisible({ timeout: 10000 });

    await expect(table.locator("tbody").getByText("Routine submitted").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("event type filter narrows results", async () => {
    const filterSelect = page.getByLabel("Event type");

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/activity-log") &&
        resp.url().includes("event_type=manual_adjustment"),
      ),
      filterSelect.selectOption("manual_adjustment"),
    ]);

    await expect(
      page.locator("table tbody").getByText("Manual adjustment").first()
        .or(page.getByText("No activity found")),
    ).toBeVisible({ timeout: 10000 });

    await filterSelect.selectOption("all");
    await expect(
      page.locator("table tbody").getByText("Routine submitted").first()
        .or(page.getByText("No activity found")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("date range filter works", async () => {
    await paceForRateLimiter(page);

    const today = new Date().toISOString().split("T")[0];
    const startDateInput = page.getByLabel("Start date");
    const endDateInput = page.getByLabel("End date");

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/activity-log") &&
        resp.url().includes("start_date="),
      ),
      startDateInput.fill(today),
    ]);

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/activity-log") &&
        resp.url().includes("end_date="),
      ),
      endDateInput.fill(today),
    ]);

    await expect(page.locator("table tbody tr").first()).toBeVisible({ timeout: 10000 });

    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/activity-log"),
      ),
      startDateInput.fill("2020-01-01"),
    ]);
    await Promise.all([
      page.waitForResponse((resp) =>
        resp.url().includes("/api/admin/activity-log"),
      ),
      endDateInput.fill("2020-01-02"),
    ]);

    await expect(page.getByText("No activity found")).toBeVisible({
      timeout: 10000,
    });

    await startDateInput.fill("");
    await endDateInput.fill("");
  });
});
