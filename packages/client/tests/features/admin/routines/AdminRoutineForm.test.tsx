import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import AdminRoutineForm from "../../../../src/features/admin/routines/AdminRoutineForm.js";

const mockExistingRoutine = {
  id: 1,
  name: "Morning Routine",
  timeSlot: "morning",
  completionRule: "once_per_day",
  points: 5,
  requiresApproval: false,
  randomizeItems: true,
  sortOrder: 1,
  items: [
    { id: 10, routineId: 1, label: "Brush teeth", sortOrder: 0 },
    { id: 11, routineId: 1, label: "Make bed", sortOrder: 1 },
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
      <MemoryRouter initialEntries={["/admin/routines/new"]}>
        <Routes>
          <Route path="/admin/routines/new" element={<AdminRoutineForm />} />
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
      <MemoryRouter initialEntries={["/admin/routines/1/edit"]}>
        <Routes>
          <Route path="/admin/routines/:id/edit" element={<AdminRoutineForm />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminRoutineForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all fields for create mode", () => {
    renderCreateForm();

    expect(screen.getByText("New Routine")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Time Slot")).toBeInTheDocument();
    expect(screen.getByLabelText("Completion Rule")).toBeInTheDocument();
    expect(screen.getByLabelText("Points")).toBeInTheDocument();
    expect(screen.getByLabelText("Requires approval")).toBeInTheDocument();
    expect(screen.getByLabelText("Randomize items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("loads and populates existing routine in edit mode", async () => {
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json({ data: mockExistingRoutine }),
      ),
    );

    renderEditForm();

    await waitFor(() => {
      expect(screen.getByText("Edit Routine")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Name")).toHaveValue("Morning Routine");
    expect(screen.getByLabelText("Time Slot")).toHaveValue("morning");
    expect(screen.getByLabelText("Points")).toHaveValue(5);
    expect(screen.getByDisplayValue("Brush teeth")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Make bed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("submits create with correct data", async () => {
    let capturedBody: unknown;
    server.use(
      http.post("/api/admin/routines", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: { ...mockExistingRoutine, id: 99 } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Evening Routine");
    await user.selectOptions(screen.getByLabelText("Time Slot"), "bedtime");
    await user.clear(screen.getByLabelText("Points"));
    await user.type(screen.getByLabelText("Points"), "10");

    const itemInput = screen.getByLabelText("Checklist item 1");
    await user.type(itemInput, "Brush teeth");

    await user.click(screen.getByRole("button", { name: "Save & Close" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.name).toBe("Evening Routine");
    expect(body.timeSlot).toBe("bedtime");
    expect(body.points).toBe(10);
    expect(body.items).toEqual([{ label: "Brush teeth", sortOrder: 0, imageAssetId: null }]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/routines");
    });
  });

  it("submits update in edit mode", async () => {
    let capturedBody: unknown;
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json({ data: mockExistingRoutine }),
      ),
      http.put("/api/admin/routines/1", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ data: mockExistingRoutine });
      }),
    );

    const user = userEvent.setup();
    renderEditForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Morning Routine");
    });

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated Routine");
    await user.click(screen.getByRole("button", { name: "Save & Close" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.name).toBe("Updated Routine");

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/routines");
    });
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    const itemInput = screen.getByLabelText("Checklist item 1");
    await user.type(itemInput, "Brush teeth");

    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("shows validation error when no checklist items have text", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Test Routine");
    await user.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByText("At least one checklist item is required")).toBeInTheDocument();
  });

  it("adds and removes checklist items", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    expect(screen.getByLabelText("Checklist item 1")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));
    expect(screen.getByLabelText("Checklist item 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(screen.queryByLabelText("Checklist item 2")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Checklist item 1")).toBeInTheDocument();
  });

  it("disables submit button during request", async () => {
    server.use(
      http.post("/api/admin/routines", async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(
          { data: { ...mockExistingRoutine, id: 99 } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await user.type(screen.getByLabelText("Name"), "Test Routine");
    await user.type(screen.getByLabelText("Checklist item 1"), "Step 1");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    });
  });

  it("navigates back on Cancel", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/routines");
  });

  it("reorders checklist items with up/down arrows", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole("button", { name: "+ Add Item" }));

    await user.type(screen.getByLabelText("Checklist item 1"), "First");
    await user.type(screen.getByLabelText("Checklist item 2"), "Second");

    await user.click(screen.getByRole("button", { name: "Move item 1 down" }));

    const inputs = screen.getAllByRole("textbox").filter(
      (el) => el.id.startsWith("item-"),
    );
    expect(inputs[0]).toHaveValue("Second");
    expect(inputs[1]).toHaveValue("First");
  });

  it("shows error state when loading existing routine fails", async () => {
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json(
          { error: { code: "NOT_FOUND", message: "Routine not found" } },
          { status: 404 },
        ),
      ),
    );

    renderEditForm();

    await waitFor(() => {
      expect(screen.getByText("Could not load routine.")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Back to Routines" })).toBeInTheDocument();
  });
});
