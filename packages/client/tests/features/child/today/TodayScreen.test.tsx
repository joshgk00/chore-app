import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnlineProvider } from "../../../../src/contexts/OnlineContext.js";
import TodayScreen from "../../../../src/features/child/today/TodayScreen.js";
import { server } from "../../../msw/server.js";

function renderTodayScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/today"]}>
        <OnlineProvider>
          <TodayScreen />
        </OnlineProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TodayScreen", () => {
  it("shows loading skeleton while bootstrap data loads", async () => {
    server.use(
      http.get("/api/app/bootstrap", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: { routines: [], pendingRoutineCount: 0 } });
      }),
    );

    renderTodayScreen();

    expect(screen.getByText("Loading your routines...")).toBeInTheDocument();
  });

  it("renders routine cards and greeting on success", async () => {
    renderTodayScreen();

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    expect(screen.getByText(/good (morning|afternoon|evening)/i)).toBeInTheDocument();
    expect(screen.getByText("Quick Win")).toBeInTheDocument();
    expect(screen.getByText("Your Routines")).toBeInTheDocument();
  });

  it("shows empty state when no routines are available", async () => {
    server.use(
      http.get("/api/app/bootstrap", () =>
        HttpResponse.json({
          data: { routines: [], pendingRoutineCount: 0 },
        }),
      ),
    );

    renderTodayScreen();

    await waitFor(() => {
      expect(screen.getByText("No routines right now!")).toBeInTheDocument();
    });

    expect(screen.getByText(/check back later/i)).toBeInTheDocument();
  });

  it("renders pending badge when pendingRoutineCount is greater than zero", async () => {
    server.use(
      http.get("/api/app/bootstrap", () =>
        HttpResponse.json({
          data: {
            routines: [
              {
                id: 1,
                name: "Morning Routine",
                timeSlot: "morning",
                completionRule: "once_per_day",
                points: 5,
                requiresApproval: false,
                randomizeItems: false,
                sortOrder: 1,
                items: [{ id: 1, routineId: 1, label: "Brush teeth", sortOrder: 1 }],
              },
            ],
            pendingRoutineCount: 3,
          },
        }),
      ),
    );

    renderTodayScreen();

    await waitFor(() => {
      expect(screen.getByText("3 pending")).toBeInTheDocument();
    });
  });

  it("shows error state when API returns error", async () => {
    server.use(
      http.get("/api/app/bootstrap", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderTodayScreen();

    await waitFor(() => {
      expect(screen.getByText(/could not load your day/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders pending chore count badge when pendingChoreCount is greater than zero", async () => {
    server.use(
      http.get("/api/app/bootstrap", () =>
        HttpResponse.json({
          data: {
            routines: [
              {
                id: 1,
                name: "Morning Routine",
                timeSlot: "morning",
                completionRule: "once_per_day",
                points: 5,
                requiresApproval: false,
                randomizeItems: false,
                sortOrder: 1,
                items: [{ id: 1, routineId: 1, label: "Brush teeth", sortOrder: 1 }],
              },
            ],
            pendingRoutineCount: 0,
            pendingChoreCount: 2,
          },
        }),
      ),
    );

    renderTodayScreen();

    await waitFor(() => {
      expect(screen.getByText("2 pending")).toBeInTheDocument();
    });
  });

  it("shows happy mascot when bootstrap includes a recent lastApprovalAt", async () => {
    server.use(
      http.get("/api/app/bootstrap", () =>
        HttpResponse.json({
          data: {
            routines: [
              {
                id: 1,
                name: "Morning Routine",
                timeSlot: "morning",
                completionRule: "once_per_day",
                points: 5,
                requiresApproval: false,
                randomizeItems: false,
                sortOrder: 1,
                items: [{ id: 1, routineId: 1, label: "Brush teeth", sortOrder: 1 }],
              },
            ],
            pendingRoutineCount: 0,
            lastApprovalAt: new Date().toISOString(),
          },
        }),
      ),
    );

    renderTodayScreen();

    await waitFor(() => {
      const mascot = screen.getByRole("img", { name: /mascot/i });
      expect(mascot).toHaveAttribute("data-state", "happy");
    });
  });

  it("refetches when refresh button is clicked", async () => {
    let requestCount = 0;
    server.use(
      http.get("/api/app/bootstrap", () => {
        requestCount++;
        return HttpResponse.json({
          data: {
            routines: [
              {
                id: 1,
                name: "Morning Routine",
                timeSlot: "morning",
                completionRule: "once_per_day",
                points: 5,
                requiresApproval: false,
                randomizeItems: false,
                sortOrder: 1,
                items: [{ id: 1, routineId: 1, label: "Brush teeth", sortOrder: 1 }],
              },
            ],
            pendingRoutineCount: 0,
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderTodayScreen();

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    const initialCount = requestCount;
    await user.click(screen.getByRole("button", { name: /refresh routines/i }));

    await waitFor(() => {
      expect(requestCount).toBeGreaterThan(initialCount);
    });
  });
});
