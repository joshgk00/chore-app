import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminRoutinesList from "../../../../src/features/admin/routines/AdminRoutinesList.js";

const mockRoutines = [
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
  {
    id: 2,
    name: "Bedtime Routine",
    timeSlot: "bedtime",
    completionRule: "once_per_slot",
    points: 3,
    requiresApproval: true,
    randomizeItems: false,
    sortOrder: 2,
    items: [{ id: 2, routineId: 2, label: "Pajamas", sortOrder: 1 }],
    archivedAt: "2026-03-20T00:00:00",
  },
];

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/routines"]}>
        <AdminRoutinesList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminRoutinesList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while routines load", async () => {
    server.use(
      http.get("/api/admin/routines", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderList();
    expect(screen.getByText("Loading routines...")).toBeInTheDocument();
  });

  it("renders routine list after data loads", async () => {
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json({ data: mockRoutines }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    expect(screen.getByText("Bedtime Routine")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Morning")).toBeInTheDocument();
    expect(screen.getByText("Bedtime")).toBeInTheDocument();
  });

  it("shows archived routines with visual indicator", async () => {
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json({ data: mockRoutines }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Bedtime Routine")).toBeInTheDocument();
    });

    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls archive endpoint when Archive is clicked", async () => {
    let archiveCalled = false;
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json({ data: mockRoutines }),
      ),
      http.post("/api/admin/routines/1/archive", () => {
        archiveCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Morning Routine")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(archiveCalled).toBe(true);
    });
  });

  it("calls unarchive endpoint when Unarchive is clicked", async () => {
    let unarchiveCalled = false;
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json({ data: mockRoutines }),
      ),
      http.post("/api/admin/routines/2/unarchive", () => {
        unarchiveCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Bedtime Routine")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    await waitFor(() => {
      expect(unarchiveCalled).toBe(true);
    });
  });

  it("shows empty state when no routines exist", async () => {
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("No routines yet")).toBeInTheDocument();
    });
  });

  it("shows error state with retry button on failure", async () => {
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Could not load routines.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("displays New Routine link", async () => {
    server.use(
      http.get("/api/admin/routines", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderList();

    expect(screen.getByRole("link", { name: "New Routine" })).toHaveAttribute(
      "href",
      "/admin/routines/new",
    );
  });
});
