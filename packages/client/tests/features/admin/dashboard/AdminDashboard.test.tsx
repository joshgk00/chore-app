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

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    expect(screen.getByText("Clean Kitchen")).toBeInTheDocument();
    expect(screen.getByText("Extra Screen Time")).toBeInTheDocument();
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

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByRole("button", { name: "Approve" });
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
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText("Could not load approvals.")).toBeInTheDocument();
    });

    expect(screen.getByText("Could not load activity.")).toBeInTheDocument();
    expect(screen.getByText("Could not load points.")).toBeInTheDocument();
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
});
