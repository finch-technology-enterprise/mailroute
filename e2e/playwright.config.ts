import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "../playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
  webServer: {
    command: "npm run dev",
    port: 8787,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      JWT_SECRET: "test-jwt-secret-for-playwright",
      CONFIG_ENCRYPTION_KEY: "test-encryption-key-for-playwright",
      RESET_TOKEN_SECRET: "test-reset-secret-for-playwright",
      WEBHOOK_SECRET: "test-webhook-secret-for-playwright",
    },
  },
});
