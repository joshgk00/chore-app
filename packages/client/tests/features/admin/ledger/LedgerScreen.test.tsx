import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import LedgerScreen from "../../../../src/features/admin/ledger/LedgerScreen.js";

const mockBalance = { total: 150, reserved: 20, available: 130 };

const mockEntries = [
  {
    id: 3,
    entryType: "manual",
    referenceTable: null,
    referenceId: null,
    amount: 25,
    note: "Bonus for great week",
    createdAt: "2026-03-20T10:00:00",
  },
  {
    id: 2,
    entryType: "routine",
    referenceTable: "routine_completions",
    referenceId: 1,
    amount: 5,
    note: "Completed: Morning Routine",
    createdAt: "2026-03-19T08:00:00",
  },
  {
    id: 1,
    entryType: "reward",
    referenceTable: "reward_requests",
    referenceId: 1,
    amount: -20,
    note: "Redeemed: Extra Screen Time",
    createdAt: "2026-03-18T15:00:00",
  },
];

function renderLedger() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/ledger"]}>
        <LedgerScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LedgerScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while data loads", async () => {
    server.use(
      http.get("/api/admin/points/ledger", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: { entries: [], balance: mockBalance } });
      }),
    );

    renderLedger();
    expect(screen.getByText("Loading ledger...")).toBeInTheDocument();
  });

  it("renders balance header with total, reserved, and available", async () => {
    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json({ data: { entries: mockEntries, balance: mockBalance } }),
      ),
    );

    renderLedger();

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    expect(screen.getByText("20")).toBeInTheDocument();
    expect(screen.getByText("130")).toBeInTheDocument();
  });

  it("renders ledger entries with amount and note", async () => {
    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json({ data: { entries: mockEntries, balance: mockBalance } }),
      ),
    );

    renderLedger();

    await waitFor(() => {
      expect(screen.getByText("Bonus for great week")).toBeInTheDocument();
    });

    expect(screen.getByText("Completed: Morning Routine")).toBeInTheDocument();
    expect(screen.getByText("Redeemed: Extra Screen Time")).toBeInTheDocument();
  });

  it("shows empty state when no entries exist", async () => {
    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json({ data: { entries: [], balance: { total: 0, reserved: 0, available: 0 } } }),
      ),
    );

    renderLedger();

    await waitFor(() => {
      expect(screen.getByText(/no ledger entries/i)).toBeInTheDocument();
    });
  });

  it("shows error state with retry button on failure", async () => {
    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json(
          { error: { code: "INTERNAL_ERROR", message: "Server error" } },
          { status: 500 },
        ),
      ),
    );

    renderLedger();

    await waitFor(() => {
      expect(screen.getByText(/could not load/i)).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("creates a manual adjustment when form is submitted", async () => {
    let adjustCalled = false;
    let adjustBody: Record<string, unknown> = {};

    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json({ data: { entries: mockEntries, balance: mockBalance } }),
      ),
      http.post("/api/admin/points/adjust", async ({ request }) => {
        adjustCalled = true;
        adjustBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            data: {
              entry: {
                id: 4,
                entryType: "manual",
                referenceTable: null,
                referenceId: null,
                amount: 10,
                note: "Test adjustment",
                createdAt: "2026-03-21T10:00:00",
              },
              balance: { total: 160, reserved: 20, available: 140 },
            },
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderLedger();

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "10");
    await user.type(screen.getByLabelText("Note"), "Test adjustment");
    await user.click(screen.getByRole("button", { name: /adjust/i }));

    await waitFor(() => {
      expect(adjustCalled).toBe(true);
    });

    expect(adjustBody).toEqual({ amount: 10, note: "Test adjustment" });
  });

  it("shows validation error when note is empty on submit", async () => {
    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json({ data: { entries: [], balance: mockBalance } }),
      ),
    );

    const user = userEvent.setup();
    renderLedger();

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "5");
    await user.click(screen.getByRole("button", { name: /adjust/i }));

    await waitFor(() => {
      expect(screen.getByText(/note.*required/i)).toBeInTheDocument();
    });
  });

  it("shows validation error when amount is 0", async () => {
    server.use(
      http.get("/api/admin/points/ledger", () =>
        HttpResponse.json({ data: { entries: [], balance: mockBalance } }),
      ),
    );

    const user = userEvent.setup();
    renderLedger();

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    await user.clear(screen.getByLabelText("Amount"));
    await user.type(screen.getByLabelText("Amount"), "0");
    await user.type(screen.getByLabelText("Note"), "some note");
    await user.click(screen.getByRole("button", { name: /adjust/i }));

    await waitFor(() => {
      expect(screen.getByText(/non-zero/i)).toBeInTheDocument();
    });
  });
});
