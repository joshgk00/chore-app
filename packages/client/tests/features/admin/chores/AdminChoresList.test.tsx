import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminChoresList from "../../../../src/features/admin/chores/AdminChoresList.js";

const mockChores = [
  {
    id: 1,
    name: "Clean Kitchen",
    requiresApproval: false,
    sortOrder: 1,
    tiers: [
      { id: 1, choreId: 1, name: "Quick Clean", points: 3, sortOrder: 1 },
      { id: 2, choreId: 1, name: "Deep Clean", points: 5, sortOrder: 2 },
    ],
  },
  {
    id: 2,
    name: "Old Chore",
    requiresApproval: false,
    sortOrder: 2,
    tiers: [
      { id: 3, choreId: 2, name: "Standard", points: 2, sortOrder: 1 },
    ],
    archivedAt: "2026-03-20T00:00:00",
  },
];

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/chores"]}>
        <AdminChoresList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminChoresList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while chores load", async () => {
    server.use(
      http.get("/api/admin/chores", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderList();
    expect(screen.getByText("Loading chores...")).toBeInTheDocument();
  });

  it("renders chore list with tier counts after data loads", async () => {
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json({ data: mockChores }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Clean Kitchen")).toBeInTheDocument();
    });

    expect(screen.getByText("Old Chore")).toBeInTheDocument();
    expect(screen.getByText("2 tiers")).toBeInTheDocument();
    expect(screen.getByText("1 tier")).toBeInTheDocument();
  });

  it("shows archived chores with visual indicator", async () => {
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json({ data: mockChores }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Old Chore")).toBeInTheDocument();
    });

    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls archive endpoint when Archive is clicked", async () => {
    let archiveCalled = false;
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json({ data: mockChores }),
      ),
      http.post("/api/admin/chores/1/archive", () => {
        archiveCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Clean Kitchen")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(archiveCalled).toBe(true);
    });
  });

  it("calls unarchive endpoint when Unarchive is clicked", async () => {
    let unarchiveCalled = false;
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json({ data: mockChores }),
      ),
      http.post("/api/admin/chores/2/unarchive", () => {
        unarchiveCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Old Chore")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    await waitFor(() => {
      expect(unarchiveCalled).toBe(true);
    });
  });

  it("shows empty state when no chores exist", async () => {
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("No chores yet")).toBeInTheDocument();
    });
  });

  it("shows error state with retry button on failure", async () => {
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Could not load chores.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("displays New Chore link", async () => {
    server.use(
      http.get("/api/admin/chores", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderList();

    expect(screen.getByRole("link", { name: "New Chore" })).toHaveAttribute(
      "href",
      "/admin/chores/new",
    );
  });
});
