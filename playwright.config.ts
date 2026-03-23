import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 5173,
    timeout: 30_000,
    reuseExistingServer: true,
    env: {
      PUBLIC_ORIGIN: "http://localhost:3000",
      INITIAL_ADMIN_PIN: "123456",
      DATA_DIR: "./data-e2e",
    },
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
