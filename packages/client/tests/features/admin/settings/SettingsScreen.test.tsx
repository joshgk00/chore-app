import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import SettingsScreen from "../../../../src/features/admin/settings/SettingsScreen.js";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockSettings: Record<string, string> = {
  timezone: "America/Chicago",
  activity_retention_days: "90",
  morning_start: "05:00",
  morning_end: "10:59",
  afternoon_start: "15:00",
  afternoon_end: "18:29",
  bedtime_start: "18:30",
  bedtime_end: "21:30",
};

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/admin/settings"]}>
        <SettingsScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state while fetching", async () => {
    server.use(
      http.get("/api/admin/settings", async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json({ data: mockSettings });
      }),
    );

    renderComponent();
    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  it("renders settings form with current values", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("05:00")).toBeInTheDocument();
    });

    expect(screen.getByDisplayValue("10:59")).toBeInTheDocument();
    expect(screen.getByDisplayValue("15:00")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18:29")).toBeInTheDocument();
    expect(screen.getByDisplayValue("18:30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("21:30")).toBeInTheDocument();
    expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    expect(screen.getByDisplayValue("90")).toBeInTheDocument();
  });

  it("updates time slots on save", async () => {
    let savedBody: Record<string, unknown> = {};

    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
      http.put("/api/admin/settings", async ({ request }) => {
        savedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: mockSettings });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("05:00")).toBeInTheDocument();
    });

    const morningStartInput = screen.getByDisplayValue("05:00");
    await user.clear(morningStartInput);
    await user.type(morningStartInput, "06:00");

    await user.click(screen.getByRole("button", { name: /save time slots/i }));

    await waitFor(() => {
      expect(savedBody).toHaveProperty("morning_start", "06:00");
    });

    expect(savedBody).toHaveProperty("morning_end", "10:59");
    expect(savedBody).toHaveProperty("afternoon_start", "15:00");
  });

  it("updates general settings on save", async () => {
    let savedBody: Record<string, unknown> = {};

    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
      http.put("/api/admin/settings", async ({ request }) => {
        savedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ data: mockSettings });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });

    const timezoneInput = screen.getByLabelText("Timezone");
    await user.clear(timezoneInput);
    await user.type(timezoneInput, "UTC");

    await user.click(screen.getByRole("button", { name: /save general/i }));

    await waitFor(() => {
      expect(savedBody).toHaveProperty("timezone", "UTC");
    });

    expect(savedBody).toHaveProperty("activity_retention_days", "90");
  });

  it("shows validation error for invalid time format", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("05:00")).toBeInTheDocument();
    });

    const morningStartInput = screen.getByDisplayValue("05:00");
    await user.clear(morningStartInput);
    await user.type(morningStartInput, "abc");

    await user.click(screen.getByRole("button", { name: /save time slots/i }));

    await waitFor(() => {
      expect(screen.getByText(/HH:MM format/i)).toBeInTheDocument();
    });
  });

  it("requires current PIN, new PIN, and confirm PIN", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /change pin/i }));

    await waitFor(() => {
      expect(screen.getByText("Current PIN is required")).toBeInTheDocument();
    });

    expect(screen.getByText("New PIN is required")).toBeInTheDocument();
    expect(screen.getByText("Confirm your new PIN")).toBeInTheDocument();
  });

  it("shows error if PINs do not match", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Current PIN"), "123456");
    await user.type(screen.getByLabelText("New PIN"), "654321");
    await user.type(screen.getByLabelText("Confirm new PIN"), "999999");

    await user.click(screen.getByRole("button", { name: /change pin/i }));

    await waitFor(() => {
      expect(screen.getByText("PINs do not match")).toBeInTheDocument();
    });
  });

  it("redirects after successful PIN change", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
      http.put("/api/admin/settings/pin", () =>
        HttpResponse.json({ data: { message: "PIN updated" } }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Current PIN"), "123456");
    await user.type(screen.getByLabelText("New PIN"), "654321");
    await user.type(screen.getByLabelText("Confirm new PIN"), "654321");

    await user.click(screen.getByRole("button", { name: /change pin/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/admin/pin");
    });
  });

  it("shows error state with retry button on API failure", async () => {
    let callCount = 0;

    server.use(
      http.get("/api/admin/settings", () => {
        callCount++;
        if (callCount <= 1) {
          return HttpResponse.json(
            { error: { code: "INTERNAL_ERROR", message: "Server error" } },
            { status: 500 },
          );
        }
        return HttpResponse.json({ data: mockSettings });
      }),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/could not load settings/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Try Again" }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });
  });

  it("shows PIN error when new PIN is too short", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Current PIN"), "123456");
    await user.type(screen.getByLabelText("New PIN"), "123");
    await user.type(screen.getByLabelText("Confirm new PIN"), "123");

    await user.click(screen.getByRole("button", { name: /change pin/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 6 digits/i)).toBeInTheDocument();
    });
  });

  it("shows error when timezone is empty", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("America/Chicago")).toBeInTheDocument();
    });

    const timezoneInput = screen.getByLabelText("Timezone");
    await user.clear(timezoneInput);

    await user.click(screen.getByRole("button", { name: /save general/i }));

    await waitFor(() => {
      expect(screen.getByText("Timezone is required")).toBeInTheDocument();
    });
  });

  it("shows error when retention days is empty", async () => {
    server.use(
      http.get("/api/admin/settings", () =>
        HttpResponse.json({ data: mockSettings }),
      ),
    );

    const user = userEvent.setup();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("90")).toBeInTheDocument();
    });

    const retentionInput = screen.getByLabelText("Activity retention (days)");
    await user.clear(retentionInput);

    await user.click(screen.getByRole("button", { name: /save general/i }));

    await waitFor(() => {
      expect(screen.getByText(/positive whole number/i)).toBeInTheDocument();
    });
  });
});
