import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Routes, Route, MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OnlineProvider } from "../../../../src/contexts/OnlineContext.js";
import RoutineChecklist from "../../../../src/features/child/routines/RoutineChecklist.js";
import { resetDbCache, deleteDraft, getDraft, saveDraft } from "../../../../src/lib/draft.js";
import { server } from "../../../msw/server.js";
import "fake-indexeddb/auto";

function renderChecklist(routineId = 1) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/routines/${routineId}`]}>
        <OnlineProvider>
          <Routes>
            <Route path="/routines/:id" element={<RoutineChecklist />} />
            <Route path="/routines" element={<div data-testid="routines-page">Routines</div>} />
            <Route path="/today" element={<div data-testid="today-page">Today</div>} />
          </Routes>
        </OnlineProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function waitForChecklistReady() {
  await screen.findByRole("checkbox", { name: "Brush teeth" });
  await waitFor(() => {
    expect(screen.getByText(/of \d+ completed/)).toBeInTheDocument();
  });
}

async function checkAllItems(user: ReturnType<typeof userEvent.setup>) {
  const brushTeeth = screen.getByRole("checkbox", { name: "Brush teeth" });
  await user.click(brushTeeth);
  await waitFor(() => expect(brushTeeth).toHaveAttribute("aria-checked", "true"));

  const makeBed = screen.getByRole("checkbox", { name: "Make bed" });
  await user.click(makeBed);
  await waitFor(() => expect(makeBed).toHaveAttribute("aria-checked", "true"));

  await waitFor(() => {
    expect(screen.getByRole("button", { name: /complete routine/i })).toBeEnabled();
  });
}

describe("RoutineChecklist", () => {
  beforeEach(async () => {
    await deleteDraft(1);
    await deleteDraft(2);
    resetDbCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders checklist items from API data", async () => {
    renderChecklist(1);

    await waitFor(() => {
      expect(screen.getByText("Brush teeth")).toBeInTheDocument();
    });
    expect(screen.getByText("Make bed")).toBeInTheDocument();
  });

  it("checking an item updates aria-checked", async () => {
    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    const item = screen.getByRole("checkbox", { name: "Brush teeth" });
    expect(item).toHaveAttribute("aria-checked", "false");

    await user.click(item);

    await waitFor(() => {
      expect(item).toHaveAttribute("aria-checked", "true");
    });
  });

  it("checking an item persists to IndexedDB draft", async () => {
    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    const item = screen.getByRole("checkbox", { name: "Brush teeth" });
    await user.click(item);

    await waitFor(() => {
      expect(item).toHaveAttribute("aria-checked", "true");
    });

    const draft = await getDraft(1);
    expect(draft).toBeDefined();
    const checkedItem = draft!.items.find((i) => i.itemId === 1);
    expect(checkedItem?.isChecked).toBe(true);
  });

  it("submit button is disabled when not all items are checked", async () => {
    renderChecklist(1);

    await waitForChecklistReady();

    const submitButton = screen.getByRole("button", { name: /complete routine/i });
    expect(submitButton).toBeDisabled();
  });

  it("submit button becomes enabled after checking all items", async () => {
    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    const submitButton = screen.getByRole("button", { name: /complete routine/i });
    expect(submitButton).toBeEnabled();
  });

  it("shows points earned message and navigates to homepage after successful submit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    await user.click(screen.getByRole("button", { name: /complete routine/i }));

    await waitFor(() => {
      expect(screen.getByText("+5 pts earned!")).toBeInTheDocument();
    });

    await act(() => vi.advanceTimersByTime(2000));

    await waitFor(() => {
      expect(screen.getByTestId("today-page")).toBeInTheDocument();
    });
  });

  it("shows pending approval message when routine requires approval", async () => {
    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json(
          {
            data: {
              id: 2,
              routineId: 1,
              routineNameSnapshot: "Morning Routine",
              pointsSnapshot: 5,
              requiresApprovalSnapshot: true,
              status: "pending",
              completedAt: new Date().toISOString(),
              localDate: new Date().toISOString().slice(0, 10),
              idempotencyKey: "test-key",
            },
          },
          { status: 201 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    await user.click(screen.getByRole("button", { name: /complete routine/i }));

    await waitFor(() => {
      expect(screen.getByText("+5 pts pending approval")).toBeInTheDocument();
    });
  });

  it("draft is deleted after successful submit", async () => {
    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    await user.click(screen.getByRole("button", { name: /complete routine/i }));

    await waitFor(() => {
      expect(screen.getByTestId("today-page")).toBeInTheDocument();
    }, { timeout: 3000 });

    const draft = await getDraft(1);
    expect(draft).toBeUndefined();
  });

  it("shuffle button is disabled once any item is checked", async () => {
    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();

    const shuffleButton = screen.getByRole("button", { name: /shuffle/i });
    expect(shuffleButton).toBeEnabled();

    const item = screen.getByRole("checkbox", { name: "Brush teeth" });
    await user.click(item);
    await waitFor(() => {
      expect(item).toHaveAttribute("aria-checked", "true");
    });

    expect(shuffleButton).toBeDisabled();
  });

  it("shows toast and navigates back on 409 archived error", async () => {
    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "archived" } },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    await user.click(screen.getByRole("button", { name: /complete routine/i }));

    await waitFor(() => {
      expect(screen.getByText(/archived/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("routines-page")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("shows toast and navigates back on 409 already_completed error", async () => {
    server.use(
      http.post("/api/routine-completions", () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "already_completed" } },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    await user.click(screen.getByRole("button", { name: /complete routine/i }));

    await waitFor(() => {
      expect(screen.getByText(/already completed/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId("routines-page")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it("shows error toast on network failure and marks draft for retry", async () => {
    server.use(
      http.post("/api/routine-completions", () => HttpResponse.error()),
    );

    const user = userEvent.setup();
    renderChecklist(1);

    await waitForChecklistReady();
    await checkAllItems(user);

    await user.click(screen.getByRole("button", { name: /complete routine/i }));

    await waitFor(() => {
      expect(screen.getByText(/went wrong/i)).toBeInTheDocument();
    });

    const draft = await getDraft(1);
    expect(draft).toBeDefined();
    expect(draft!.hasSubmissionFailed).toBe(true);
  });

  it("shows loading skeleton while routine is loading", async () => {
    server.use(
      http.get("/api/routines/:id", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: null });
      }),
    );

    renderChecklist(1);

    expect(screen.getByText("Loading routine...")).toBeInTheDocument();
  });

  it("shows error state when API returns 500", async () => {
    server.use(
      http.get("/api/routines/:id", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderChecklist(1);

    await waitFor(() => {
      expect(screen.getByText(/could not load this routine/i)).toBeInTheDocument();
    });
  });

  it("discards stale draft and shows toast when item IDs mismatch", async () => {
    await saveDraft({
      routineId: 1,
      items: [
        { itemId: 999, isChecked: true },
        { itemId: 888, isChecked: false },
      ],
      startedAt: new Date().toISOString(),
      idempotencyKey: "stale-key",
    });

    renderChecklist(1);

    await waitFor(() => {
      expect(screen.getByText(/starting fresh/i)).toBeInTheDocument();
    });

    const draft = await getDraft(1);
    if (draft) {
      const draftItemIds = new Set(draft.items.map((i) => i.itemId));
      expect(draftItemIds.has(999)).toBe(false);
      expect(draftItemIds.has(888)).toBe(false);
    }
  });
});
