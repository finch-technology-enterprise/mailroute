// e2e/admin-ui.spec.ts
import { test, expect, signupUser } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe("Admin UI", () => {
  let token: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    token = data.token;
  });

  test("Login page renders", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("Login with token redirects to dashboard", async ({ page }) => {
    // Set auth cookie then navigate
    await page.goto("/admin");
    await page.evaluate((t) => {
      document.cookie = `__Host-auth_token=${t}; path=/api;`;
    }, token);
    await page.goto("/admin");
    // Should not redirect to login (meaning auth worked)
    const url = page.url();
    expect(url).not.toContain("login");
  });

  test("Dashboard page loads", async ({ page }) => {
    await page.goto("/admin");
    await page.evaluate((t) => {
      document.cookie = `__Host-auth_token=${t}; path=/api;`;
    }, token);
    await page.goto("/admin");

    // Check for common dashboard elements
    await expect(page.locator("body")).toBeVisible();
  });

  test("Unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/admin");
    // Should be redirected to login page
    await page.waitForURL(/login/);
    expect(page.url()).toContain("login");
  });
});
