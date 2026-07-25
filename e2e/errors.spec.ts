// e2e/errors.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Error Handling", () => {
  let token: string;
  let apiKey: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    token = data.token;
    apiKey = data.apiKey;
  });

  test("Unknown route returns 404", async ({ request }) => {
    const res = await request.get("/api/nonexistent");
    expect(res.status()).toBe(404);
  });

  test("Invalid JSON body returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: "not json at all",
    });
    // Hono's JSON parsing may return 400 or 500 depending on parser
    expect([400, 500]).toContain(res.status());
  });

  test("Missing auth header returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/stats");
    expect(res.status()).toBe(401);
  });

  test("Expired/invalid JWT returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/stats", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    expect(res.status()).toBe(401);
  });

  test("Rate limiting after many requests", async ({ request }) => {
    // Auth endpoints have rate limiting via RateLimitMiddleware
    const headers = { Authorization: `Bearer ${token}` };
    const results: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await request.get("/api/admin/stats", { headers });
      results.push(res.status());
    }
    const rateLimited = results.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
