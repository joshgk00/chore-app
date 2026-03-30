import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import QuickActionsPanel from "../../../../src/features/admin/dashboard/QuickActionsPanel.js";
import type { PendingApprovals } from "@chore-app/shared";

const mockPendingApprovals: PendingApprovals = {
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
  rewardRequests: [],
};

const mockPointsEconomy = {
  earnedThisWeek: 25,
  earnedLastWeek: 18,
  redeemedAllTime: 40,
};

function setupHandlers() {
  server.use(
    http.get("/api/admin/points/economy", () =>
      HttpResponse.json({ data: mockPointsEconomy }),
    ),
  );
}

function renderPanel(pendingApprovals?: PendingApprovals) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuickActionsPanel pendingApprovals={pendingApprovals} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("QuickActionsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHandlers();
  });

  it("renders Quick Actions heading", () => {
    renderPanel(mockPendingApprovals);
    expect(
      screen.getByRole("heading", { name: "Quick Actions" }),
    ).toBeInTheDocument();
  });

  it("shows Approve All button with pending count", async () => {
    renderPanel(mockPendingApprovals);
    expect(
      screen.getByRole("button", { name: "Approve All" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 pending")).toBeInTheDocument();
  });

  it("disables Approve All when no pending items", () => {
    renderPanel({
      routineCompletions: [],
      choreLogs: [],
      rewardRequests: [],
    });

    const button = screen.getByRole("button", { name: "Approve All" });
    expect(button).toBeDisabled();
  });

  it("shows confirmation dialog before batch approve", async () => {
    const user = userEvent.setup();
    renderPanel(mockPendingApprovals);

    await user.click(screen.getByRole("button", { name: "Approve All" }));

    expect(
      screen.getByText("Approve all 2 pending items?"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("cancels batch approve confirmation", async () => {
    const user = userEvent.setup();
    renderPanel(mockPendingApprovals);

    await user.click(screen.getByRole("button", { name: "Approve All" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(
      screen.queryByText("Approve all 2 pending items?"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve All" }),
    ).toBeInTheDocument();
  });

  it("executes batch approve on confirm", async () => {
    let batchApproveCalled = false;
    server.use(
      http.post("/api/admin/approvals/batch-approve", () => {
        batchApproveCalled = true;
        return HttpResponse.json({
          data: { approvedCount: 2, failedCount: 0, errors: [] },
        });
      }),
    );

    const user = userEvent.setup();
    renderPanel(mockPendingApprovals);

    await user.click(screen.getByRole("button", { name: "Approve All" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(batchApproveCalled).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByText("Approved 2 items")).toBeInTheDocument();
    });
  });

  it("renders create links for routines, chores, and rewards", () => {
    renderPanel(mockPendingApprovals);

    expect(screen.getByRole("link", { name: "+ Routine" })).toHaveAttribute(
      "href",
      "/admin/routines/new",
    );
    expect(screen.getByRole("link", { name: "+ Chore" })).toHaveAttribute(
      "href",
      "/admin/chores/new",
    );
    expect(screen.getByRole("link", { name: "+ Reward" })).toHaveAttribute(
      "href",
      "/admin/rewards/new",
    );
  });

  it("renders backup export button", () => {
    renderPanel(mockPendingApprovals);
    expect(
      screen.getByRole("button", { name: "Export Backup" }),
    ).toBeInTheDocument();
  });

  it("renders points economy summary", async () => {
    renderPanel(mockPendingApprovals);

    await waitFor(() => {
      expect(screen.getByText("25 pts")).toBeInTheDocument();
    });

    expect(screen.getByText("18 pts")).toBeInTheDocument();
    expect(screen.getByText("40 pts")).toBeInTheDocument();
    expect(screen.getByText("This week:")).toBeInTheDocument();
    expect(screen.getByText("Last week:")).toBeInTheDocument();
    expect(screen.getByText("Total redeemed:")).toBeInTheDocument();
  });

  it("shows trend up indicator when this week exceeds last week", async () => {
    renderPanel(mockPendingApprovals);

    await waitFor(() => {
      expect(screen.getByText("25 pts")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Trending up from last week"),
    ).toBeInTheDocument();
  });

  it("shows trend down indicator when this week is less than last week", async () => {
    server.use(
      http.get("/api/admin/points/economy", () =>
        HttpResponse.json({
          data: {
            earnedThisWeek: 10,
            earnedLastWeek: 25,
            redeemedAllTime: 40,
          },
        }),
      ),
    );

    renderPanel(mockPendingApprovals);

    await waitFor(() => {
      expect(screen.getByText("10 pts")).toBeInTheDocument();
    });

    expect(
      screen.getByLabelText("Trending down from last week"),
    ).toBeInTheDocument();
  });

  it("shows error state when economy data fails to load", async () => {
    server.use(
      http.get("/api/admin/points/economy", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    renderPanel(mockPendingApprovals);

    await waitFor(() => {
      expect(
        screen.getByText("Could not load economy data."),
      ).toBeInTheDocument();
    });
  });

  it("shows batch approve error when API fails", async () => {
    server.use(
      http.post("/api/admin/approvals/batch-approve", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderPanel(mockPendingApprovals);

    await user.click(screen.getByRole("button", { name: "Approve All" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() => {
      expect(
        screen.getByText("Batch approve failed. Please try again."),
      ).toBeInTheDocument();
    });
  });
});
