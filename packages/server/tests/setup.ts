// Global test setup for server tests
import { vi } from "vitest";

// Mock web-push globally — createApp now initializes pushService which calls
// webpush.setVapidDetails with real key validation. Tests need fake keys to pass.
vi.mock("web-push", () => ({
  default: {
    generateVAPIDKeys: () => ({
      publicKey: "BN_test_public_key_for_testing_push_notifications",
      privateKey: "test_private_key_for_push",
    }),
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue({}),
  },
}));
