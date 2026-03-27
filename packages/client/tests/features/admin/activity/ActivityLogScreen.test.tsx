import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import ActivityLogScreen from "../../../../src/features/admin/activity/ActivityLogScreen.js";

const mockEvents = [
  {
    id: 1,
    eventType: "routine_submitted",
    entityType: "routine_completion",
    entityId: 1,
    summary: "Completed Morning Routine for 5 points",
    createdAt: "2026-03-20T08:00:00",
  },
  {
    id: 2,
    eventType: "chore_submitted",
    entityType: "chore_log",
    entityId: 2,
    summary: "Logged Clean Kitchen (Quick Clean) for 3 points",
    createdAt: "2026-03-20T10:00:00",
  },
  {
    id: 3,
    eventType: "reward_requested",
    entityType: "reward_request",
    entityId: 1,
    summary: "Requested Extra Screen Time for 20 points",
    createdAt: "2026-03-20T14:00:00",
  },
  {
    id: 4,
    eventType: "manual_adjustment",
    entityType: null,
    entityId: null,
    summary: "Manual adjustment: +10 bonus",
    createdAt: "2026-03-20T16:00:00",
  },
];

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/activity"]}>
        <ActivityLogScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ActivityLogScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching", async () => {
    server.use(
      http.get("/api/admin/activity-log", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({
          data: { events: [], total: 0, page: 0, limit: 50 },
        });
      }),
    );

    renderComponent();
    expect(screen.getByText("Loading activity log...")).toBeInTheDocument();
  });

  it("renders activity events in table", async () => {
    server.use(
      http.get("/api/admin/activity-log", () =>
        HttpResponse.json({
          data: { events: mockEvents, total: 4, page: 0, limit: 50 },
        }),
      ),
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Completed Morning Routine for 5 points")).toBeInTheDocument();
    });

    expect(screen.getByText("Logged Clean Kitchen (Quick Clean) for 3 points")).toBeInTheDocument();
    expect(screen.getByText("Requested Extra Screen Time for 20 points")).toBeInTheDocument();
    expect(screen.getByText("Manual adjustment: +10 bonus")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: "Activity log entries" });
    expect(within(table).getAllByText(/submitted|requested|adjustment/).length).toBeGreaterThanOrEqual(4);
  });

  it("filters by event type", async () => {
    let lastUrl = "";

    server.use(
      http.get("/api/admin/activity-log", ({ request }) => {
        lastUrl = request.url;
        const url = new URL(request.url);
        const eventType = url.searchParams.get("event_type");
        const filtered = eventType
          ? mockEvents.filter((e) => e.eventType === eventType)
          : mockEvents;
        return HttpResponse.json({
          data: { events: filtered, total: filtered.length, page: 0, limit: 50 },
        });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Completed Morning Routine for 5 points")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText("Event type"), "routine_submitted");

    await waitFor(() => {
      expect(lastUrl).toContain("event_type=routine_submitted");
    });
  });

  it("filters by date range", async () => {
    let lastUrl = "";

    server.use(
      http.get("/api/admin/activity-log", ({ request }) => {
        lastUrl = request.url;
        return HttpResponse.json({
          data: { events: mockEvents, total: 4, page: 0, limit: 50 },
        });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Completed Morning Routine for 5 points")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Start date"), "2026-03-19");

    await waitFor(() => {
      expect(lastUrl).toContain("start_date=2026-03-19");
    });

    await user.type(screen.getByLabelText("End date"), "2026-03-21");

    await waitFor(() => {
      expect(lastUrl).toContain("end_date=2026-03-21");
    });
  });

  it("paginates with next and previous", async () => {
    const page0Events = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      eventType: "routine_submitted",
      entityType: "routine_completion",
      entityId: i + 1,
      summary: `Event ${i + 1}`,
      createdAt: "2026-03-20T08:00:00",
    }));

    const page1Events = [
      {
        id: 51,
        eventType: "chore_submitted",
        entityType: "chore_log",
        entityId: 51,
        summary: "Event 51",
        createdAt: "2026-03-20T08:00:00",
      },
    ];

    server.use(
      http.get("/api/admin/activity-log", ({ request }) => {
        const url = new URL(request.url);
        const page = Number(url.searchParams.get("page") ?? "0");
        const events = page === 0 ? page0Events : page1Events;
        return HttpResponse.json({
          data: { events, total: 51, page, limit: 50 },
        });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Previous" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Previous" }));

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });
  });

  it("shows empty state when no events", async () => {
    server.use(
      http.get("/api/admin/activity-log", () =>
        HttpResponse.json({
          data: { events: [], total: 0, page: 0, limit: 50 },
        }),
      ),
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/no activity found/i)).toBeInTheDocument();
    });
  });

  it("shows error state with retry", async () => {
    let callCount = 0;

    server.use(
      http.get("/api/admin/activity-log", () => {
        callCount++;
        if (callCount <= 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "Server error" } },
            { status: 500 },
          );
        }
        return HttpResponse.json({
          data: { events: mockEvents, total: 4, page: 0, limit: 50 },
        });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/could not load the activity log/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => {
      expect(screen.getByText("Completed Morning Routine for 5 points")).toBeInTheDocument();
    });
  });

  it("shows offline state when not connected", async () => {
    server.use(
      http.get("/api/admin/activity-log", () =>
        HttpResponse.json(
          { error: { code: "NETWORK_ERROR", message: "offline" } },
          { status: 500 },
        ),
      ),
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/could not load the activity log/i)).toBeInTheDocument();
    });
  });

  it("has accessible table with aria-label", async () => {
    server.use(
      http.get("/api/admin/activity-log", () =>
        HttpResponse.json({
          data: { events: mockEvents, total: 4, page: 0, limit: 50 },
        }),
      ),
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("table", { name: "Activity log entries" })).toBeInTheDocument();
    });
  });
});
