// e2e/admin-ui.spec.ts
import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe("Admin UI", () => {
  const authenticate = async (page: Page) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("mailroute_api_key", "mr_playwright");
      const nativeFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        const method =
          init?.method ?? (input instanceof Request ? input.method : "GET");

        if (url.endsWith("/api/auth/me")) {
          return new Response(
            JSON.stringify({ success: true, data: { user: {} } }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.endsWith("/api/admin/api-keys")) {
          const data =
            method === "POST"
              ? { rawKey: "mr_created_key", name: "Playwright" }
              : [];
          return new Response(JSON.stringify({ success: true, data }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        return nativeFetch(input, init);
      };
    });
  };

  test("Login page renders", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("Login with token redirects to dashboard", async ({ page }) => {
    // Set auth cookie then navigate
    await authenticate(page);
    await page.goto("/admin");
    // Should not redirect to login (meaning auth worked)
    const url = page.url();
    expect(url).not.toContain("login");
  });

  test("Dashboard page loads", async ({ page }) => {
    await authenticate(page);
    await page.goto("/admin");

    // Check for common dashboard elements
    await expect(page.locator("body")).toBeVisible();
  });

  test("API key modal manages focus, background, and dismissal", async ({
    page,
  }) => {
    await authenticate(page);
    await page.goto("/admin/api-keys");

    const createButton = page
      .getByRole("button", { name: "Create Key", exact: true })
      .first();
    await createButton.click();

    const dialog = page.getByRole("dialog", { name: "Create API Key" });
    const nameInput = dialog.getByLabel("Key name");
    await expect(dialog).toBeVisible();
    await expect(nameInput).toBeFocused();
    await expect(page.locator("#root")).toHaveJSProperty("inert", true);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    await nameInput.fill("Focus trap");
    await page.keyboard.press("Shift+Tab");
    await expect(dialog.getByRole("button", { name: "Create" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(nameInput).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(createButton).toBeFocused();
    await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");

    await page.getByRole("button", { name: "Add Existing Key" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add Existing Key" });
    await expect(addDialog.getByLabel("API key")).toBeFocused();
    await page.locator(".modal-overlay").click({ position: { x: 4, y: 4 } });
    await expect(addDialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Add Existing Key" }),
    ).toBeFocused();
    await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");
  });

  test("reduced motion keeps modal feedback without spatial movement", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await authenticate(page);
    await page.goto("/admin/api-keys");

    const createButton = page
      .getByRole("button", { name: "Create Key", exact: true })
      .first();
    await createButton.click();
    const dialog = page.getByRole("dialog", { name: "Create API Key" });
    await expect(dialog).toBeVisible();
    const inlineMotion = await dialog.evaluate((element) => ({
      transform: element.style.transform,
      filter: element.style.filter,
    }));
    expect(inlineMotion).toEqual({ transform: "", filter: "" });
    await expect(dialog).toHaveCSS("transform", "none");
    await expect(dialog).toHaveCSS("filter", "none");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    await expect(createButton).toBeFocused();
  });

  test("API key dialog handoff preserves the modal stack", async ({ page }) => {
    await authenticate(page);
    await page.goto("/admin/api-keys");

    const createButton = page
      .getByRole("button", { name: "Create Key", exact: true })
      .first();
    await createButton.click();
    const createDialog = page.getByRole("dialog", { name: "Create API Key" });
    await createDialog.getByLabel("Key name").fill("Playwright");
    await createDialog.getByRole("button", { name: "Create" }).click();

    const createdDialog = page.getByRole("dialog", { name: "API Key Created" });
    await expect(createdDialog).toBeVisible();
    await expect(
      createdDialog.getByRole("button", { name: "Copy API key" }),
    ).toBeFocused();
    await expect(createDialog).toBeHidden();
    await expect(page.locator("#root")).toHaveJSProperty("inert", true);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(createdDialog).toBeHidden();
    await expect(createButton).toBeFocused();
    await expect(page.locator("#root")).toHaveJSProperty("inert", false);
    await expect
      .poll(() => page.evaluate(() => document.body.style.overflow))
      .toBe("");
  });

  test("Unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/admin");
    // Should be redirected to login page
    await page.waitForURL(/login/);
    expect(page.url()).toContain("login");
  });
});
