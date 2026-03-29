import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import RoutineHealthScreen from "../../../../src/features/admin/routine-health/RoutineHealthScreen.js";

const mockData = {
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
  ],
  timeSlotBreakdown: [
    { timeSlot: "morning", completedCount: 5, routineCount: 1 },
    { timeSlot: "afternoon", completedCount: 0, routineCount: 1 },
  ],
  streakDays: 3,
};

function setupHandlers() {
  server.use(
    http.get("/api/admin/routine-analytics", () =>
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
      <MemoryRouter initialEntries={["/admin/routine-health"]}>
        <RoutineHealthScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RoutineHealthScreen", () => {
  beforeEach(() => {
    setupHandlers();
  });

  it("renders heading and breadcrumb", () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { name: "Routine Health" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Dashboard").closest("a")).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("shows streak section with count", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Streak" }),
      ).toBeInTheDocument();
    });

    const streakSection = screen.getByRole("region", { name: "Streak" });
    expect(within(streakSection).getByText("3")).toBeInTheDocument();
    expect(within(streakSection).getByText("day streak")).toBeInTheDocument();
  });

  it("shows completion rates for all routines", async () => {
    renderScreen();

    const ratesSection = await waitFor(() => {
      const section = screen.getByRole("region", {
        name: "Completion rates",
      });
      expect(
        within(section).getByText("Morning Routine"),
      ).toBeInTheDocument();
      return section;
    });

    expect(
      within(ratesSection).getByText("Afternoon Check"),
    ).toBeInTheDocument();
  });

  it("highlights neglected routines", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Needs attention" }),
      ).toBeInTheDocument();
    });

    const alertSection = screen.getByRole("region", { name: "Needs attention" });
    expect(
      within(alertSection).getByText("Afternoon Check"),
    ).toBeInTheDocument();
  });

  it("shows time-slot breakdown", async () => {
    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Time slot breakdown" }),
      ).toBeInTheDocument();
    });

    const slotSection = screen.getByRole("region", {
      name: "Time slot breakdown",
    });
    expect(within(slotSection).getByText("Morning")).toBeInTheDocument();
    expect(within(slotSection).getByText("Afternoon")).toBeInTheDocument();
  });

  it("hides needs-attention section when all routines have completions", async () => {
    server.use(
      http.get("/api/admin/routine-analytics", () =>
        HttpResponse.json({
          data: {
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
                daysCompleted: 3,
                totalDays: 7,
              },
            ],
            timeSlotBreakdown: [
              { timeSlot: "morning", completedCount: 5, routineCount: 1 },
              { timeSlot: "afternoon", completedCount: 3, routineCount: 1 },
            ],
            streakDays: 3,
          },
        }),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByRole("region", { name: "Completion rates" }),
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("region", { name: "Needs attention" }),
    ).not.toBeInTheDocument();
  });

  it("shows error state with retry button when API fails", async () => {
    server.use(
      http.get("/api/admin/routine-analytics", () =>
        HttpResponse.json(
          { error: { code: "SERVER_ERROR", message: "fail" } },
          { status: 500 },
        ),
      ),
    );

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText("Could not load routine health data."),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: "Try Again" }),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton initially", () => {
    renderScreen();
    expect(screen.getByText("Loading routine health...")).toBeInTheDocument();
  });
});
