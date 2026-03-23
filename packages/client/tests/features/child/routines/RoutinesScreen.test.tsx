import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnlineProvider } from "../../../../src/contexts/OnlineContext.js";
import RoutinesScreen from "../../../../src/features/child/routines/RoutinesScreen.js";
import { server } from "../../../msw/server.js";

function renderRoutinesScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/routines"]}>
        <OnlineProvider>
          <RoutinesScreen />
        </OnlineProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RoutinesScreen", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  it("shows loading skeleton while routines are loading", async () => {
    server.use(
      http.get("/api/routines", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderRoutinesScreen();

    expect(screen.getByText("Loading routines...")).toBeInTheDocument();
    expect(screen.getByText("My Routines")).toBeInTheDocument();
  });

  it("renders routines grouped by time slot", async () => {
    renderRoutinesScreen();

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: /Morning/, level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Quick Win")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Any Time/, level: 2 })).toBeInTheDocument();
  });

  it("shows empty state when no routines exist", async () => {
    server.use(
      http.get("/api/routines", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderRoutinesScreen();

    await waitFor(() => {
      expect(screen.getByText("No routines yet!")).toBeInTheDocument();
    });

    expect(screen.getByText(/ask a grown-up/i)).toBeInTheDocument();
  });

  it("shows error state when API returns error", async () => {
    server.use(
      http.get("/api/routines", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderRoutinesScreen();

    await waitFor(() => {
      expect(screen.getByText(/could not load routines/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("refetches when Try Again is clicked after error", async () => {
    let requestCount = 0;
    server.use(
      http.get("/api/routines", () => {
        requestCount++;
        if (requestCount === 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "Server error" } },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: [
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
        });
      }),
    );

    const user = userEvent.setup();
    renderRoutinesScreen();

    await waitFor(() => {
      expect(screen.getByText(/could not load routines/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    expect(requestCount).toBeGreaterThanOrEqual(2);
  });

  it("shows offline banner when navigator is offline", async () => {
    Object.defineProperty(navigator, "onLine", { value: false, writable: true });

    renderRoutinesScreen();

    await waitFor(() => {
      expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    });
  });
});
