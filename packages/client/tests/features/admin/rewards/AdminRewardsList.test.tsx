import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminRewardsList from "../../../../src/features/admin/rewards/AdminRewardsList.js";

const mockRewards = [
  {
    id: 1,
    name: "Extra Screen Time",
    pointsCost: 20,
    sortOrder: 1,
  },
  {
    id: 2,
    name: "Old Reward",
    pointsCost: 10,
    sortOrder: 2,
    archivedAt: "2026-01-01T00:00:00",
  },
];

function renderList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/rewards"]}>
        <AdminRewardsList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminRewardsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while rewards load", async () => {
    server.use(
      http.get("/api/admin/rewards", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: [] });
      }),
    );

    renderList();
    expect(screen.getByText("Loading rewards...")).toBeInTheDocument();
  });

  it("renders reward list with points cost after data loads", async () => {
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json({ data: mockRewards }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Extra Screen Time")).toBeInTheDocument();
    });

    expect(screen.getByText("Old Reward")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows archived rewards with visual indicator", async () => {
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json({ data: mockRewards }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Old Reward")).toBeInTheDocument();
    });

    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("calls archive endpoint when Archive is clicked", async () => {
    let archiveCalled = false;
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json({ data: mockRewards }),
      ),
      http.post("/api/admin/rewards/1/archive", () => {
        archiveCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Extra Screen Time")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(archiveCalled).toBe(true);
    });
  });

  it("calls unarchive endpoint when Unarchive is clicked", async () => {
    let unarchiveCalled = false;
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json({ data: mockRewards }),
      ),
      http.post("/api/admin/rewards/2/unarchive", () => {
        unarchiveCalled = true;
        return HttpResponse.json({ data: null });
      }),
    );

    const user = userEvent.setup();
    renderList();

    await waitFor(() => {
      expect(screen.getByText("Old Reward")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Unarchive" }));

    await waitFor(() => {
      expect(unarchiveCalled).toBe(true);
    });
  });

  it("shows empty state when no rewards exist", async () => {
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("No rewards yet")).toBeInTheDocument();
    });
  });

  it("shows error state with retry button on failure", async () => {
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderList();

    await waitFor(() => {
      expect(screen.getByText("Could not load rewards.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("displays New Reward link", async () => {
    server.use(
      http.get("/api/admin/rewards", () =>
        HttpResponse.json({ data: [] }),
      ),
    );

    renderList();

    expect(screen.getByRole("link", { name: "New Reward" })).toHaveAttribute(
      "href",
      "/admin/rewards/new",
    );
  });
});
