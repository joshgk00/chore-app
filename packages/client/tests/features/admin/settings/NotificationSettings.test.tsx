import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationSettings from "../../../../src/features/admin/settings/NotificationSettings.js";
import { usePushSupport } from "../../../../src/lib/push.js";

vi.mock("../../../../src/lib/push.js", () => ({
  usePushSupport: vi.fn(),
}));

const mockUsePushSupport = usePushSupport as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationSettings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("NotificationSettings", () => {
  it("returns null when push is not supported", () => {
    mockUsePushSupport.mockReturnValue({
      isSupported: false,
      permission: null,
      subscribe: vi.fn(),
      isSubscribing: false,
      error: null,
    });

    const { container } = renderComponent();

    expect(container.innerHTML).toBe("");
  });

  it("shows enabled message when permission is granted", () => {
    mockUsePushSupport.mockReturnValue({
      isSupported: true,
      permission: "granted",
      subscribe: vi.fn(),
      isSubscribing: false,
      error: null,
    });

    renderComponent();

    expect(
      screen.getByText("Admin notifications are enabled."),
    ).toBeInTheDocument();
  });

  it("shows blocked message when permission is denied", () => {
    mockUsePushSupport.mockReturnValue({
      isSupported: true,
      permission: "denied",
      subscribe: vi.fn(),
      isSubscribing: false,
      error: null,
    });

    renderComponent();

    expect(
      screen.getByText(
        "Notifications are blocked. Update your browser settings to enable them.",
      ),
    ).toBeInTheDocument();
  });

  it("shows Enable button when permission is default", () => {
    mockUsePushSupport.mockReturnValue({
      isSupported: true,
      permission: "default",
      subscribe: vi.fn(),
      isSubscribing: false,
      error: null,
    });

    renderComponent();

    expect(
      screen.getByRole("button", { name: /enable admin notifications/i }),
    ).toBeInTheDocument();
  });

  it("calls subscribe with 'admin' when Enable button is clicked", async () => {
    const mockSubscribe = vi.fn();
    mockUsePushSupport.mockReturnValue({
      isSupported: true,
      permission: "default",
      subscribe: mockSubscribe,
      isSubscribing: false,
      error: null,
    });

    const user = userEvent.setup();
    renderComponent();

    await user.click(
      screen.getByRole("button", { name: /enable admin notifications/i }),
    );

    expect(mockSubscribe).toHaveBeenCalledWith("admin");
  });

  it("shows 'Enabling...' when isSubscribing is true", () => {
    mockUsePushSupport.mockReturnValue({
      isSupported: true,
      permission: "default",
      subscribe: vi.fn(),
      isSubscribing: true,
      error: null,
    });

    renderComponent();

    expect(screen.getByText("Enabling...")).toBeInTheDocument();
  });

  it("shows error message when push error is set", () => {
    mockUsePushSupport.mockReturnValue({
      isSupported: true,
      permission: "default",
      subscribe: vi.fn(),
      isSubscribing: false,
      error: "Something went wrong while enabling notifications.",
    });

    renderComponent();

    expect(
      screen.getByText("Something went wrong while enabling notifications."),
    ).toBeInTheDocument();
  });
});
