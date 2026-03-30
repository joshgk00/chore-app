import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import { OnlineProvider } from "../../../../src/contexts/OnlineContext.js";
import RewardDemandScreen from "../../../../src/features/admin/reward-demand/RewardDemandScreen.js";

const mockData = {
  pendingCount: 3,
  pendingTotalCost: 90,
  rankings: [
    {
      rewardId: 1,
      rewardName: "Extra Screen Time",
      requestCount: 8,
      approvedCount: 5,
      totalCost: 100,
    },
    {
      rewardId: 2,
      rewardName: "Movie Night Pick",
      requestCount: 3,
      approvedCount: 2,
      totalCost: 100,
    },
  ],
  neverRequested: [{ rewardId: 3, rewardName: "Ice Cream Trip" }],
  pointsEarned: 500,
  pointsRedeemed: 200,
};

function setupHandlers() {
  server.use(
    http.get("/api/admin/reward-analytics", () =>
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
      <MemoryRouter initialEntries={["/admin/reward-demand"]}>
        <RewardDemandScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RewardDemandScreen", () => {
  beforeEach(() => {
    setupHandlers();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, writable: true });
  });

  it("renders heading and breadcrumb", () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { name: "Reward Demand" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("shows pending requests summary", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Pending requests" }),
      ).toBeInTheDocument();
    });

    const section = screen.getByRole("region", { name: "Pending requests" });
    expect(within(section).getByText("3")).toBeInTheDocument();
    expect(within(section).getByText("90 points reserved")).toBeInTheDocument();
  });

  it("shows redemption ratio", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Redemption ratio" }),
      ).toBeInTheDocument();
    });

    const section = screen.getByRole("region", { name: "Redemption ratio" });
    expect(
      within(section).getByText("200 redeemed of 500 earned"),
    ).toBeInTheDocument();
    expect(within(section).getByText("40%")).toBeInTheDocument();
  });

  it("shows reward rankings with all rewards", async () => {
    renderScreen();

    const rankingsSection = await waitFor(() => {
      const section = screen.getByRole("region", { name: "Reward rankings" });
      expect(
        within(section).getByText("Extra Screen Time"),
      ).toBeInTheDocument();
      return section;
    });

    expect(
      within(rankingsSection).getByText("Movie Night Pick"),
    ).toBeInTheDocument();
  });

  it("highlights never-requested rewards", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Never requested" }),
      ).toBeInTheDocument();
    });

    const alertSection = screen.getByRole("region", {
      name: "Never requested",
    });
    expect(
      within(alertSection).getByText("Ice Cream Trip"),
    ).toBeInTheDocument();
  });

  it("hides never-requested section when all rewards have requests", async () => {
    server.use(
      http.get("/api/admin/reward-analytics", () =>
        HttpResponse.json({
          data: {
            ...mockData,
            neverRequested: [],
          },
        }),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Reward rankings" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("region", { name: "Never requested" }),
    ).not.toBeInTheDocument();
  });

  it("shows error state with retry button when API fails", async () => {
    server.use(
      http.get("/api/admin/reward-analytics", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText("Could not load reward demand data."),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    renderScreen();
    expect(screen.getByText("Loading reward demand...")).toBeInTheDocument();
  });

  it("shows empty state when no requests exist", async () => {
    server.use(
      http.get("/api/admin/reward-analytics", () =>
        HttpResponse.json({
          data: {
            pendingCount: 0,
            pendingTotalCost: 0,
            rankings: [],
            neverRequested: [{ rewardId: 1, rewardName: "Reward A" }],
            pointsEarned: 0,
            pointsRedeemed: 0,
          },
        }),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Reward rankings" }),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("No reward requests yet")).toBeInTheDocument();
  });

  it("shows offline message when not connected", () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <OnlineProvider>
          <MemoryRouter initialEntries={["/admin/reward-demand"]}>
            <RewardDemandScreen />
          </MemoryRouter>
        </OnlineProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByText("You're offline")).toBeInTheDocument();
  });
});
