import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminDashboard from "../../../../src/features/admin/dashboard/AdminDashboard.js";

const mockPendingApprovals = {
  routineCompletions: [
    {
      id: 1,
      routineId: 1,
      routineNameSnapshot: "Morning Routine",
      timeSlotSnapshot: "morning",
      completionRuleSnapshot: "once_per_day",
      pointsSnapshot: 5,
      requiresApprovalSnapshot: true,
      checklistSnapshotJson: null,
      randomizedOrderJson: null,
      completionWindowKey: null,
      completedAt: "2026-03-15T08:00:00",
      localDate: "2026-03-15",
      status: "pending",
      idempotencyKey: "key-1",
    },
  ],
  choreLogs: [
    {
      id: 2,
      choreId: 1,
      choreNameSnapshot: "Clean Kitchen",
      tierId: 1,
      tierNameSnapshot: "Quick Clean",
      pointsSnapshot: 3,
      requiresApprovalSnapshot: true,
      loggedAt: "2026-03-15T10:00:00",
      localDate: "2026-03-15",
      status: "pending",
      idempotencyKey: "key-2",
    },
  ],
  rewardRequests: [
    {
      id: 3,
      rewardId: 1,
      rewardNameSnapshot: "Extra Screen Time",
      costSnapshot: 20,
      requestedAt: "2026-03-15T11:00:00",
      localDate: "2026-03-15",
      status: "pending",
      idempotencyKey: "key-3",
    },
  ],
};

const mockActivityLog = {
  events: [
    {
      id: 10,
      eventType: "routine_submitted",
      entityType: "routine_completion",
      entityId: 1,
      summary: "Completed Morning Routine for 5 points",
      createdAt: "2026-03-15T12:00:00",
    },
    {
      id: 11,
      eventType: "chore_submitted",
      entityType: "chore_log",
      entityId: 2,
      summary: "Logged Clean Kitchen (Quick Clean) for 3 points",
      createdAt: "2026-03-15T11:00:00",
    },
  ],
  total: 2,
  page: 0,
  limit: 5,
};

const mockBalance = { total: 150, reserved: 20, available: 130 };

const mockChoreEngagement = {
  engagementRates: [
    {
      choreId: 1,
      choreName: "Clean Kitchen",
      submissionCount: 5,
      approvedCount: 4,
      totalPoints: 16,
    },
  ],
  inactiveChores: [],
  submissionTrends: [{ date: "2026-03-29", submissions: 5 }],
  windowDays: 14,
};

const mockRewardDemand = {
  pendingCount: 2,
  pendingTotalCost: 70,
  rankings: [
    {
      rewardId: 1,
      rewardName: "Extra Screen Time",
      requestCount: 5,
      approvedCount: 3,
      totalCost: 60,
    },
    {
      rewardId: 2,
      rewardName: "Movie Night Pick",
      requestCount: 2,
      approvedCount: 1,
      totalCost: 50,
    },
  ],
  neverRequested: [{ rewardId: 3, rewardName: "Ice Cream Trip" }],
  pointsEarned: 500,
  pointsRedeemed: 200,
};

const mockRoutineHealth = {
  completionRates: [
    {
      routineId: 1,
      routineName: "Morning Routine",
      timeSlot: "morning",
      daysCompleted: 5,
      totalDays: 7,
    },
    {
      routineId: 2,
      routineName: "Afternoon Check",
      timeSlot: "afternoon",
      daysCompleted: 0,
      totalDays: 7,
    },
    {
      routineId: 3,
      routineName: "Bedtime Routine",
      timeSlot: "bedtime",
      daysCompleted: 3,
      totalDays: 7,
    },
  ],
  timeSlotBreakdown: [
    { timeSlot: "morning", completedCount: 5, routineCount: 1 },
    { timeSlot: "afternoon", completedCount: 0, routineCount: 1 },
    { timeSlot: "bedtime", completedCount: 3, routineCount: 1 },
  ],
  streakDays: 4,
};

const mockPointsEconomy = {
  earnedThisWeek: 25,
  earnedLastWeek: 18,
  redeemedAllTime: 40,
};

function setupHandlers() {
  server.use(
    http.get("/api/admin/approvals", () =>
      HttpResponse.json({ data: mockPendingApprovals }),
    ),
    http.get("/api/admin/activity-log", () =>
      HttpResponse.json({ data: mockActivityLog }),
    ),
    http.get("/api/admin/points/ledger", () =>
      HttpResponse.json({
        data: { entries: [], balance: mockBalance },
      }),
    ),
    http.get("/api/admin/settings", () =>
      HttpResponse.json({
        data: { timezone: "America/Chicago" },
      }),
    ),
    http.get("/api/admin/routine-analytics", () =>
      HttpResponse.json({ data: mockRoutineHealth }),
    ),
    http.get("/api/admin/chore-analytics", () =>
      HttpResponse.json({ data: mockChoreEngagement }),
    ),
    http.get("/api/admin/points/economy", () =>
      HttpResponse.json({ data: mockPointsEconomy }),
    ),
    http.get("/api/admin/reward-analytics", () =>
      HttpResponse.json({ data: mockRewardDemand }),
    ),
  );
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin"]}>
        <AdminDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHandlers();
  });

  it("renders the dashboard heading", () => {
    renderDashboard();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("shows loading skeletons then resolves data", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("130")).toBeInTheDocument();
    });

    expect(screen.getByText("available points")).toBeInTheDocument();
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("renders points balance card with earned and reserved", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("130")).toBeInTheDocument();
    });

    const balanceSection = screen.getByRole("region", { name: "Points balance" });
    expect(within(balanceSection).getByText("150")).toBeInTheDocument();
    expect(within(balanceSection).getByText("earned")).toBeInTheDocument();
    expect(within(balanceSection).getByText("20")).toBeInTheDocument();
    expect(within(balanceSection).getByText("reserved")).toBeInTheDocument();
  });

  it("renders recent activity events", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Completed Morning Routine for 5 points"),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Logged Clean Kitchen (Quick Clean) for 3 points"),
    ).toBeInTheDocument();
  });

  it("renders pending approvals grouped by type", async () => {
    renderDashboard();

    const approvalsSection = screen.getByRole("region", { name: "Pending approvals" });

    await waitFor(() => {
      expect(within(approvalsSection).getByText("Morning Routine")).toBeInTheDocument();
    });

    expect(within(approvalsSection).getByText("Clean Kitchen")).toBeInTheDocument();
    expect(within(approvalsSection).getByText("Extra Screen Time")).toBeInTheDocument();
  });

  it("shows pending count badge", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("approves an item and invalidates queries", async () => {
    let approveCallCount = 0;

    server.use(
      http.post("/api/admin/approvals/:type/:id/approve", () => {
        approveCallCount++;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderDashboard();

    const approvalsSection = screen.getByRole("region", { name: "Pending approvals" });

    await waitFor(() => {
      expect(within(approvalsSection).getByText("Morning Routine")).toBeInTheDocument();
    });

    const approveButtons = within(approvalsSection).getAllByRole("button", { name: "Approve" });
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(approveCallCount).toBe(1);
    });
  });

  it("shows empty states when no data exists", async () => {
    server.use(
      http.get("/api/admin/approvals", () =>
        HttpResponse.json({
          data: { routineCompletions: [], choreLogs: [], rewardRequests: [] },
        }),
      ),
      http.get("/api/admin/activity-log", () =>
        HttpResponse.json({
          data: { events: [], total: 0, page: 0, limit: 5 },
        }),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Nothing pending")).toBeInTheDocument();
    });

    expect(screen.getByText("No recent activity")).toBeInTheDocument();
  });

  it("shows error messages when API calls fail", async () => {
    server.use(
      http.get("/api/admin/approvals", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
      http.get("/api/admin/activity-log", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
      http.get("/api/admin/routine-analytics", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Could not load approvals.")).toBeInTheDocument();
    });

    expect(screen.getByText("Could not load activity.")).toBeInTheDocument();
    expect(screen.getByText("Could not load points.")).toBeInTheDocument();
    expect(screen.getByText("Could not load routine health.")).toBeInTheDocument();
  });

  it("renders navigation links to detail screens", async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("View full queue")).toBeInTheDocument();
    });

    expect(screen.getByText("View all activity")).toBeInTheDocument();
    expect(screen.getByText("View ledger")).toBeInTheDocument();

    expect(screen.getByText("View full queue").closest("a")).toHaveAttribute(
      "href",
      "/admin/approvals",
    );
    expect(screen.getByText("View all activity").closest("a")).toHaveAttribute(
      "href",
      "/admin/activity",
    );
    expect(screen.getByText("View ledger").closest("a")).toHaveAttribute(
      "href",
      "/admin/ledger",
    );
  });

  it("renders routine health card with streak and completion rates", async () => {
    renderDashboard();

    const healthSection = screen.getByRole("region", { name: "Routine health" });

    await waitFor(() => {
      expect(within(healthSection).getByText(/4-day streak/)).toBeInTheDocument();
    });

    expect(within(healthSection).getByText("5/7")).toBeInTheDocument();
    expect(within(healthSection).getByText("0/7")).toBeInTheDocument();
    expect(within(healthSection).getByText("3/7")).toBeInTheDocument();
  });

  it("shows neglected routines warning", async () => {
    renderDashboard();

    const healthSection = screen.getByRole("region", { name: "Routine health" });

    await waitFor(() => {
      expect(
        within(healthSection).getByText(
          "1 routine with no completions this week",
        ),
      ).toBeInTheDocument();
    });
  });

  it("renders View details link to routine health page", async () => {
    renderDashboard();

    const healthSection = screen.getByRole("region", { name: "Routine health" });

    await waitFor(() => {
      expect(within(healthSection).getByText("View details")).toBeInTheDocument();
    });

    const link = within(healthSection).getByText("View details");
    expect(link.closest("a")).toHaveAttribute("href", "/admin/routine-health");
  });

  it("shows overflow link when more than 5 items in a type", async () => {
    const manyRoutines = Array.from({ length: 7 }, (_, i) => ({
      id: i + 100,
      routineId: 1,
      routineNameSnapshot: `Routine ${i + 1}`,
      timeSlotSnapshot: "morning",
      completionRuleSnapshot: "once_per_day",
      pointsSnapshot: 5,
      requiresApprovalSnapshot: true,
      checklistSnapshotJson: null,
      randomizedOrderJson: null,
      completionWindowKey: null,
      completedAt: "2026-03-15T08:00:00",
      localDate: "2026-03-15",
      status: "pending",
      idempotencyKey: `key-${i}`,
    }));

    server.use(
      http.get("/api/admin/approvals", () =>
        HttpResponse.json({
          data: {
            routineCompletions: manyRoutines,
            choreLogs: [],
            rewardRequests: [],
          },
        }),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Routine 1")).toBeInTheDocument();
    });

    expect(screen.getByText("Routine 5")).toBeInTheDocument();
    expect(screen.queryByText("Routine 6")).not.toBeInTheDocument();
    expect(screen.getByText(/2 more/)).toBeInTheDocument();
  });

  it("renders reward demand card with pending count and rankings", async () => {
    renderDashboard();

    const demandSection = screen.getByRole("region", { name: "Reward demand" });

    await waitFor(() => {
      expect(within(demandSection).getByText(/2 pending/)).toBeInTheDocument();
    });

    expect(within(demandSection).getByText("Extra Screen Time")).toBeInTheDocument();
    expect(within(demandSection).getByText("Movie Night Pick")).toBeInTheDocument();
  });

  it("shows never-requested warning in reward demand card", async () => {
    renderDashboard();

    const demandSection = screen.getByRole("region", { name: "Reward demand" });

    await waitFor(() => {
      expect(
        within(demandSection).getByText("1 reward never requested"),
      ).toBeInTheDocument();
    });
  });

  it("renders View details link to reward demand page", async () => {
    renderDashboard();

    const demandSection = screen.getByRole("region", { name: "Reward demand" });

    await waitFor(() => {
      expect(within(demandSection).getByText("View details")).toBeInTheDocument();
    });

    const link = within(demandSection).getByText("View details");
    expect(link.closest("a")).toHaveAttribute("href", "/admin/reward-demand");
  });

  it("shows reward demand error state", async () => {
    server.use(
      http.get("/api/admin/reward-analytics", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    renderDashboard();

    await waitFor(() => {
      expect(
        screen.getByText("Could not load reward demand."),
      ).toBeInTheDocument();
    });
  });
});
