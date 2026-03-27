import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminRewardForm from "../../../../src/features/admin/rewards/AdminRewardForm.js";

const mockExistingReward = {
  id: 1,
  name: "Extra Screen Time",
  pointsCost: 20,
  sortOrder: 1,
};

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderCreateForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/rewards/new"]}>
        <Routes>
          <Route path="/admin/rewards/new" element={<AdminRewardForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderEditForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/rewards/1/edit"]}>
        <Routes>
          <Route path="/admin/rewards/:id/edit" element={<AdminRewardForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminRewardForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all fields for create mode", () => {
    renderCreateForm();

    expect(screen.getByText("New Reward")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Points Cost")).toBeInTheDocument();
    expect(screen.getByLabelText("Sort Order")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Reward" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("loads and populates existing reward in edit mode", async () => {
    server.use(
      http.get("/api/admin/rewards/1", () =>
        HttpResponse.json({ data: mockExistingReward }),
      ),
    );

    renderEditForm();

    await waitFor(() => {
      expect(screen.getByText("Edit Reward")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Name")).toHaveValue("Extra Screen Time");
    expect(screen.getByLabelText("Points Cost")).toHaveValue(20);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it("submits create with correct data", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/admin/rewards", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: { ...mockExistingReward, id: 99 } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Movie Night Pick");

    const pointsCostInput = screen.getByLabelText("Points Cost");
    await user.clear(pointsCostInput);
    await user.type(pointsCostInput, "50");

    await user.click(screen.getByRole("button", { name: "Create Reward" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.name).toBe("Movie Night Pick");
    expect(body.pointsCost).toBe(50);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/rewards");
    });
  });

  it("submits update in edit mode", async () => {
    let capturedBody: unknown;
    server.use(
      http.get("/api/admin/rewards/1", () =>
        HttpResponse.json({ data: mockExistingReward }),
      ),
      http.put("/api/admin/rewards/1", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ data: mockExistingReward });
      }),
    );

    const user = userEvent.setup();
    renderEditForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Extra Screen Time");
    });

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated Reward");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.name).toBe("Updated Reward");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/rewards");
    });
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "Create Reward" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("disables submit button during request", async () => {
    server.use(
      http.post("/api/admin/rewards", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(
          { data: { ...mockExistingReward, id: 99 } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Test Reward");
    await user.click(screen.getByRole("button", { name: "Create Reward" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    });
  });

  it("navigates back on Cancel", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/rewards");
  });

  it("shows error message when create fails", async () => {
    server.use(
      http.post("/api/admin/rewards", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Database error" } },
          { status: 500 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Test Reward");
    await user.click(screen.getByRole("button", { name: "Create Reward" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows error state when loading existing reward fails", async () => {
    server.use(
      http.get("/api/admin/rewards/1", () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Reward not found" } },
          { status: 404 },
        ),
      ),
    );

    renderEditForm();

    await waitFor(() => {
      expect(screen.getByText("Could not load reward.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Back to Rewards" })).toBeInTheDocument();
  });
});
