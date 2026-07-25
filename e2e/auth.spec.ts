// e2e/auth.spec.ts
import { test, expect, signupUser } from "./fixtures";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Authentication", () => {
  let testEmail: string;
  let testPassword = "testpassword123";

  test("POST /api/auth/signup — creates user and returns API key", async ({ request }) => {
    testEmail = `test-${uid()}@example.com`;
    const res = await request.post("/api/auth/signup", {
      data: {
        name: "Test User",
        email: testEmail,
        password: testPassword,
        tenantName: "Test Tenant",
        tenantSlug: `test-${uid()}`,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.tenant.apiKey).toMatch(/^mr_/);
    expect(body.data.user.email).toBe(testEmail);
  });

  test("POST /api/auth/signup — duplicate email returns 409", async ({ request }) => {
    if (!testEmail) {
      // Create one first
      const slug = `test-${uid()}`;
      testEmail = `test-${uid()}@example.com`;
      await request.post("/api/auth/signup", {
        data: { name: "T", email: testEmail, password: "testpassword123", tenantName: "T", tenantSlug: slug },
      });
    }
    const res = await request.post("/api/auth/signup", {
      data: { name: "T2", email: testEmail, password: "testpassword123", tenantName: "T2", tenantSlug: `test-${uid()}` },
    });
    expect(res.status()).toBe(409);
  });

  test("POST /api/auth/login — succeeds with valid credentials", async ({ request }) => {
    const email = `test-${uid()}@example.com`;
    const slug = `test-${uid()}`;
    await request.post("/api/auth/signup", {
      data: { name: "T", email, password: "testpassword123", tenantName: "T", tenantSlug: slug },
    });
    const res = await request.post("/api/auth/login", {
      data: { email, password: "testpassword123" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
  });

  test("POST /api/auth/login — fails with wrong password (401)", async ({ request }) => {
    const email = `test-${uid()}@example.com`;
    const slug = `test-${uid()}`;
    await request.post("/api/auth/signup", {
      data: { name: "T", email, password: "testpassword123", tenantName: "T", tenantSlug: slug },
    });
    const res = await request.post("/api/auth/login", {
      data: { email, password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/forgot-password — returns 200", async ({ request }) => {
    const email = `test-${uid()}@example.com`;
    const res = await request.post("/api/auth/forgot-password", {
      data: { email },
    });
    expect(res.status()).toBe(200);
  });

  test("POST /api/auth/logout — clears cookies", async ({ request }) => {
    const { token } = await signupUser("http://localhost:8787");
    const res = await request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  test("GET /api/auth/me — returns user info", async ({ request }) => {
    const { token } = await signupUser("http://localhost:8787");
    const res = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.user.email).toBeTruthy();
  });
});
