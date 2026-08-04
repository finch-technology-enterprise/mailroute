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
    command:
      "npx wrangler dev --var JWT_SECRET:playwright-jwt-secret-123456789 --var CONFIG_ENCRYPTION_KEY:playwright-config-key-123456789 --var RESET_TOKEN_SECRET:playwright-reset-secret-123456789 --var WEBHOOK_SECRET:playwright-webhook-secret-123456789",
    port: 8787,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
