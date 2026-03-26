import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminChoreForm from "../../../../src/features/admin/chores/AdminChoreForm.js";

const mockExistingChore = {
  id: 1,
  name: "Clean Kitchen",
  requiresApproval: false,
  sortOrder: 1,
  tiers: [
    { id: 1, choreId: 1, name: "Quick Clean", points: 3, sortOrder: 0 },
    { id: 2, choreId: 1, name: "Deep Clean", points: 5, sortOrder: 1 },
  ],
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
      <MemoryRouter initialEntries={["/admin/chores/new"]}>
        <Routes>
          <Route path="/admin/chores/new" element={<AdminChoreForm />} />
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
      <MemoryRouter initialEntries={["/admin/chores/1/edit"]}>
        <Routes>
          <Route path="/admin/chores/:id/edit" element={<AdminChoreForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminChoreForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all fields for create mode", () => {
    renderCreateForm();

    expect(screen.getByText("New Chore")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Requires approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Chore" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("loads and populates existing chore in edit mode", async () => {
    server.use(
      http.get("/api/admin/chores/1", () =>
        HttpResponse.json({ data: mockExistingChore }),
      ),
    );

    renderEditForm();

    await waitFor(() => {
      expect(screen.getByText("Edit Chore")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Name")).toHaveValue("Clean Kitchen");
    expect(screen.getByDisplayValue("Quick Clean")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Deep Clean")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeInTheDocument();
  });

  it("submits create with correct data", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/admin/chores", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: { ...mockExistingChore, id: 99 } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Yard Work");

    const tierNameInput = screen.getByLabelText("Tier 1 name");
    await user.type(tierNameInput, "Basic");

    const tierPointsInput = screen.getByLabelText("Tier 1 points");
    await user.clear(tierPointsInput);
    await user.type(tierPointsInput, "5");

    await user.click(screen.getByRole("button", { name: "Create Chore" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.name).toBe("Yard Work");
    expect(body.tiers).toEqual([{ name: "Basic", points: 5, sortOrder: 0 }]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/chores");
    });
  });

  it("submits update in edit mode", async () => {
    let capturedBody: unknown;
    server.use(
      http.get("/api/admin/chores/1", () =>
        HttpResponse.json({ data: mockExistingChore }),
      ),
      http.put("/api/admin/chores/1", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ data: mockExistingChore });
      }),
    );

    const user = userEvent.setup();
    renderEditForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Clean Kitchen");
    });

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated Chore");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.name).toBe("Updated Chore");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/chores");
    });
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    const tierNameInput = screen.getByLabelText("Tier 1 name");
    await user.type(tierNameInput, "Basic");

    await user.click(screen.getByRole("button", { name: "Create Chore" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("shows validation error when no tiers have names", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Test Chore");
    await user.click(screen.getByRole("button", { name: "Create Chore" }));

    expect(screen.getByText("At least one tier with a name is required")).toBeInTheDocument();
  });

  it("adds and removes tiers", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.getByLabelText("Tier 1 name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Add Tier" }));
    expect(screen.getByLabelText("Tier 2 name")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove tier 1" }));
    expect(screen.queryByLabelText("Tier 2 name")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tier 1 name")).toBeInTheDocument();
  });

  it("disables submit button during request", async () => {
    server.use(
      http.post("/api/admin/chores", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(
          { data: { ...mockExistingChore, id: 99 } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Test Chore");
    await user.type(screen.getByLabelText("Tier 1 name"), "Basic");
    await user.click(screen.getByRole("button", { name: "Create Chore" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    });
  });

  it("navigates back on Cancel", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/chores");
  });

  it("reorders tiers with up/down arrows", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "+ Add Tier" }));

    await user.type(screen.getByLabelText("Tier 1 name"), "First");
    await user.type(screen.getByLabelText("Tier 2 name"), "Second");

    await user.click(screen.getByRole("button", { name: "Move tier 1 down" }));

    const inputs = screen.getAllByRole("textbox").filter(
      (el) => el.id.startsWith("tier-name-"),
    );
    expect(inputs[0]).toHaveValue("Second");
    expect(inputs[1]).toHaveValue("First");
  });

  it("shows error state when loading existing chore fails", async () => {
    server.use(
      http.get("/api/admin/chores/1", () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Chore not found" } },
          { status: 404 },
        ),
      ),
    );

    renderEditForm();

    await waitFor(() => {
      expect(screen.getByText("Could not load chore.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Back to Chores" })).toBeInTheDocument();
  });
});
