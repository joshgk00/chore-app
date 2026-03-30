import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import { OnlineProvider } from "../../../../src/contexts/OnlineContext.js";
import ChoreEngagementScreen from "../../../../src/features/admin/chore-engagement/ChoreEngagementScreen.js";

const mockData = {
  engagementRates: [
    {
      choreId: 1,
      choreName: "Clean Kitchen",
      submissionCount: 8,
      approvedCount: 7,
      totalPoints: 29,
    },
    {
      choreId: 4,
      choreName: "Laundry",
      submissionCount: 3,
      approvedCount: 3,
      totalPoints: 12,
    },
    {
      choreId: 2,
      choreName: "Yard Work",
      submissionCount: 0,
      approvedCount: 0,
      totalPoints: 0,
    },
  ],
  inactiveChores: [{ choreId: 2, choreName: "Yard Work" }],
  submissionTrends: [
    { date: "2026-03-27", submissions: 4 },
    { date: "2026-03-28", submissions: 5 },
    { date: "2026-03-29", submissions: 2 },
  ],
  windowDays: 14,
};

function setupHandlers() {
  server.use(
    http.get("/api/admin/chore-analytics", () =>
      HttpResponse.json({ data: mockData }),
    ),
    http.get("/api/admin/settings", () =>
      HttpResponse.json({ data: { timezone: "America/Chicago" } }),
    ),
  );
}

function renderScreen() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/chore-engagement"]}>
        <ChoreEngagementScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ChoreEngagementScreen", () => {
  beforeEach(() => {
    setupHandlers();
  });

  it("renders heading and breadcrumb", () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { name: "Chore Engagement" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("shows summary section with total submissions", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Summary" }),
      ).toBeInTheDocument();
    });

    const summarySection = screen.getByRole("region", { name: "Summary" });
    expect(within(summarySection).getByText("11")).toBeInTheDocument();
  });

  it("shows chore rankings with all chores", async () => {
    renderScreen();

    const rankingsSection = await waitFor(() => {
      const section = screen.getByRole("region", { name: "Chore rankings" });
      expect(within(section).getByText("Clean Kitchen")).toBeInTheDocument();
      return section;
    });

    expect(within(rankingsSection).getByText("Laundry")).toBeInTheDocument();
    expect(within(rankingsSection).getByText("Yard Work")).toBeInTheDocument();
  });

  it("highlights inactive chores", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Inactive chores" }),
      ).toBeInTheDocument();
    });

    const alertSection = screen.getByRole("region", {
      name: "Inactive chores",
    });
    expect(within(alertSection).getByText("Yard Work")).toBeInTheDocument();
  });

  it("shows submission trends", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Submission trends" }),
      ).toBeInTheDocument();
    });

    const trendsSection = screen.getByRole("region", {
      name: "Submission trends",
    });
    expect(within(trendsSection).getByText("Mar 27")).toBeInTheDocument();
    expect(within(trendsSection).getByText("Mar 29")).toBeInTheDocument();
  });

  it("hides inactive section when all chores have submissions", async () => {
    server.use(
      http.get("/api/admin/chore-analytics", () =>
        HttpResponse.json({
          data: {
            engagementRates: [
              {
                choreId: 1,
                choreName: "Clean Kitchen",
                submissionCount: 5,
                approvedCount: 5,
                totalPoints: 20,
              },
            ],
            inactiveChores: [],
            submissionTrends: [{ date: "2026-03-29", submissions: 5 }],
            windowDays: 14,
          },
        }),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Chore rankings" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("region", { name: "Inactive chores" }),
    ).not.toBeInTheDocument();
  });

  it("shows error state with retry button when API fails", async () => {
    server.use(
      http.get("/api/admin/chore-analytics", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText("Could not load chore engagement data."),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    renderScreen();
    expect(
      screen.getByText("Loading chore engagement..."),
    ).toBeInTheDocument();
  });

  it("shows empty state when no active chores exist", async () => {
    server.use(
      http.get("/api/admin/chore-analytics", () =>
        HttpResponse.json({
          data: {
            engagementRates: [],
            inactiveChores: [],
            submissionTrends: [],
            windowDays: 14,
          },
        }),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Chore rankings" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("No active chores")).toBeInTheDocument();
  });

  it("shows offline message when not connected", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <OnlineProvider>
          <MemoryRouter initialEntries={["/admin/chore-engagement"]}>
            <ChoreEngagementScreen />
          </MemoryRouter>
        </OnlineProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("You're offline")).toBeInTheDocument();

    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });
});
