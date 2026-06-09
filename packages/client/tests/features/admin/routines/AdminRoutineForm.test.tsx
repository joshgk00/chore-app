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

const mockCloneSourceRoutine = {
  id: 1,
  name: "Leave for School",
  timeSlot: "bedtime",
  completionRule: "once_per_slot",
  points: 12,
  requiresApproval: true,
  randomizeItems: true,
  sortOrder: 4,
  imageAssetId: 7,
  imageUrl: "/assets/routine-school.png",
  items: [
    {
      id: 20,
      routineId: 1,
      label: "Pack backpack",
      sortOrder: 0,
      imageAssetId: 8,
      imageUrl: "/assets/backpack.png",
    },
    {
      id: 21,
      routineId: 1,
      label: "Fill water bottle",
      sortOrder: 1,
      imageAssetId: null,
      imageUrl: null,
    },
    {
      id: 22,
      routineId: 1,
      label: "Archived school step",
      sortOrder: 2,
      archivedAt: "2026-06-01T12:00:00.000Z",
      imageAssetId: 9,
      imageUrl: "/assets/archived-step.png",
    },
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

function renderCloneForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/routines/new?cloneFrom=1"]}>
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

  it("loads a clone source as an unsaved draft with copied settings and images", async () => {
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json({ data: mockCloneSourceRoutine }),
      ),
    );

    renderCloneForm();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Clone Routine" })).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Name")).toHaveValue("Leave for School (Copy)");
    expect(screen.getByLabelText("Time Slot")).toHaveValue("bedtime");
    expect(screen.getByLabelText("Completion Rule")).toHaveValue("once_per_slot");
    expect(screen.getByLabelText("Points")).toHaveValue(12);
    expect(screen.getByLabelText("Requires approval")).toBeChecked();
    expect(screen.getByLabelText("Randomize items")).toBeChecked();
    expect(screen.getByDisplayValue("Pack backpack")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fill water bottle")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Image for Routine Image" })).toHaveAttribute(
      "src",
      "/assets/routine-school.png",
    );
    expect(screen.getByRole("img", { name: "Image for Image for item 1" })).toHaveAttribute(
      "src",
      "/assets/backpack.png",
    );
    expect(screen.getByRole("button", { name: "Create" })).toBeInTheDocument();
  });

  it("submits a clone as a fresh routine with copied asset ids and no source ids", async () => {
    let capturedBody: unknown;
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json({ data: mockCloneSourceRoutine }),
      ),
      http.post("/api/admin/routines", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: { ...mockCloneSourceRoutine, id: 99, name: "Leave for School (Copy)" } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCloneForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Leave for School (Copy)");
    });

    await user.click(screen.getByRole("button", { name: "Save & Close" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    const items = body.items as Record<string, unknown>[];
    expect(body).not.toHaveProperty("id");
    expect(body).not.toHaveProperty("imageUrl");
    expect(body.name).toBe("Leave for School (Copy)");
    expect(body.sortOrder).toBe(0);
    expect(body.imageAssetId).toBe(7);
    expect(items).toEqual([
      { label: "Pack backpack", sortOrder: 0, imageAssetId: 8 },
      { label: "Fill water bottle", sortOrder: 1, imageAssetId: null },
    ]);
    expect(items.every((item) => !("id" in item))).toBe(true);
    expect(items.every((item) => !("imageUrl" in item))).toBe(true);
  });

  it("can trim a clone draft before saving with reindexed item order", async () => {
    let capturedBody: unknown;
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json({ data: mockCloneSourceRoutine }),
      ),
      http.post("/api/admin/routines", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { data: { ...mockCloneSourceRoutine, id: 99, name: "Leave for Camp" } },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderCloneForm();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Pack backpack")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Remove item 1" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Leave for Camp");
    await user.click(screen.getByRole("button", { name: "Save & Close" }));

    await waitFor(() => {
      expect(capturedBody).toBeTruthy();
    });

    const body = capturedBody as Record<string, unknown>;
    expect(body.items).toEqual([
      { label: "Fill water bottle", sortOrder: 0, imageAssetId: null },
    ]);
  });

  it("excludes archived checklist items from a clone draft", async () => {
    server.use(
      http.get("/api/admin/routines/1", () =>
        HttpResponse.json({ data: mockCloneSourceRoutine }),
      ),
    );

    renderCloneForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveValue("Leave for School (Copy)");
    });

    expect(screen.getByDisplayValue("Pack backpack")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Archived school step")).not.toBeInTheDocument();
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

  it("shows secondary add-item button when 3+ items exist", async () => {
    const user = userEvent.setup();
    renderCreateForm();

    const addButtons = () => screen.getAllByRole("button", { name: "+ Add Item" });

    expect(addButtons()).toHaveLength(1);

    await user.click(addButtons()[0]);
    expect(addButtons()).toHaveLength(1);

    await user.click(addButtons()[0]);
    expect(addButtons()).toHaveLength(2);

    await user.click(addButtons()[1]);
    expect(screen.getByLabelText("Checklist item 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Checklist item 4")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Remove item 4" }));
    await user.click(screen.getByRole("button", { name: "Remove item 3" }));
    expect(addButtons()).toHaveLength(1);
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
