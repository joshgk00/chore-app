import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { server } from "../../../msw/server.js";
import NotificationOptIn from "../../../../src/features/child/me/NotificationOptIn.js";

function buildQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = buildQueryClient();
  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    ),
  });
}

// Valid base64url string for VAPID key mock
const FAKE_VAPID_KEY = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const mockSubscription = {
  toJSON: () => ({
    endpoint: "https://push.example.com/sub/123",
    keys: {
      p256dh: "BFAKE_P256DH_KEY",
      auth: "FAKE_AUTH_KEY",
    },
  }),
};

function createMockRegistration() {
  return {
    pushManager: {
      subscribe: vi.fn().mockResolvedValue(mockSubscription),
    },
  };
}

const originalPushManager = Object.getOwnPropertyDescriptor(window, "PushManager");
const originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
const originalNotification = Object.getOwnPropertyDescriptor(window, "Notification");

function installPushGlobals(permission: NotificationPermission = "default") {
  const registration = createMockRegistration();

  Object.defineProperty(window, "PushManager", {
    value: class PushManager {},
    writable: true,
    configurable: true,
  });

  Object.defineProperty(navigator, "serviceWorker", {
    value: {
      ready: Promise.resolve(registration),
      register: vi.fn().mockResolvedValue(registration),
    },
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "Notification", {
    value: {
      permission,
      requestPermission: vi.fn().mockResolvedValue("granted"),
    },
    writable: true,
    configurable: true,
  });
}

function removePushGlobals() {
  if (originalPushManager) {
    Object.defineProperty(window, "PushManager", originalPushManager);
  } else {
    delete (window as Record<string, unknown>).PushManager;
  }

  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    delete (navigator as Record<string, unknown>).serviceWorker;
  }

  if (originalNotification) {
    Object.defineProperty(window, "Notification", originalNotification);
  } else {
    delete (window as Record<string, unknown>).Notification;
  }
}

describe("NotificationOptIn", () => {
  afterEach(() => {
    removePushGlobals();
    vi.restoreAllMocks();
  });

  describe("when push is NOT supported", () => {
    beforeEach(() => {
      removePushGlobals();
    });

    it("shows unavailable message", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.getByText("Notifications aren't available on this device."),
      ).toBeInTheDocument();
    });

    it("does not show the enable button", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.queryByRole("button", { name: /enable/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when push is supported with 'default' permission", () => {
    beforeEach(() => {
      installPushGlobals("default");
    });

    it("shows the enable button", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.getByRole("button", { name: /enable notifications/i }),
      ).toBeInTheDocument();
    });

    it("shows description text", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.getByText("Get reminders for your routines and chores."),
      ).toBeInTheDocument();
    });
  });

  describe("when push is supported with 'granted' permission", () => {
    beforeEach(() => {
      installPushGlobals("granted");
    });

    it("shows enabled state", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(screen.getByText("Notifications enabled")).toBeInTheDocument();
    });

    it("does not show the enable button", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.queryByRole("button", { name: /enable/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("when push is supported with 'denied' permission", () => {
    beforeEach(() => {
      installPushGlobals("denied");
    });

    it("shows blocked message", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.getByText(
          "Notifications are blocked. Update your browser settings to enable them.",
        ),
      ).toBeInTheDocument();
    });

    it("does not show the enable button", () => {
      renderWithProviders(<NotificationOptIn />);

      expect(
        screen.queryByRole("button", { name: /enable/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe("subscribe flow", () => {
    beforeEach(() => {
      installPushGlobals("default");

      server.use(
        http.get("/api/push/vapid-public-key", () =>
          HttpResponse.json({ data: { key: FAKE_VAPID_KEY } }),
        ),
        http.post("/api/push/subscribe", () =>
          HttpResponse.json({ data: { id: 1 } }, { status: 201 }),
        ),
      );
    });

    it("calls the API when subscribe button is clicked", async () => {
      let subscribeBody: unknown = null;
      server.use(
        http.post("/api/push/subscribe", async ({ request }) => {
          subscribeBody = await request.json();
          return HttpResponse.json({ data: { id: 1 } }, { status: 201 });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<NotificationOptIn />);

      const button = screen.getByRole("button", {
        name: /enable notifications/i,
      });
      await user.click(button);

      await waitFor(() => {
        expect(subscribeBody).toEqual(
          expect.objectContaining({
            role: "child",
            endpoint: "https://push.example.com/sub/123",
            p256dh: "BFAKE_P256DH_KEY",
            auth: "FAKE_AUTH_KEY",
          }),
        );
      });
    });

    it("shows loading state while subscribing", async () => {
      server.use(
        http.get("/api/push/vapid-public-key", async () => {
          await new Promise((resolve) => setTimeout(resolve, 200));
          return HttpResponse.json({ data: { key: FAKE_VAPID_KEY } });
        }),
      );

      const user = userEvent.setup();
      renderWithProviders(<NotificationOptIn />);

      const button = screen.getByRole("button", {
        name: /enable notifications/i,
      });
      await user.click(button);

      expect(screen.getByText("Enabling...")).toBeInTheDocument();
    });

    it("shows error when vapid key fetch fails", async () => {
      server.use(
        http.get("/api/push/vapid-public-key", () =>
          HttpResponse.json(
            { error: { code: "INTERNAL", message: "fail" } },
            { status: 500 },
          ),
        ),
      );

      const user = userEvent.setup();
      renderWithProviders(<NotificationOptIn />);

      await user.click(
        screen.getByRole("button", { name: /enable notifications/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            "Could not retrieve push configuration from the server.",
          ),
        ).toBeInTheDocument();
      });
    });
  });
});
