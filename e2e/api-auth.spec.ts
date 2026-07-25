// e2e/api-auth.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("API Key Authentication", () => {
  test("POST /api/send-email — missing header returns 401", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      data: { to: "test@example.com", subject: "Test", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/send-email — invalid key returns 401", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: { "X-API-AUTH-KEY": "mr_invalidkey123" },
      data: { to: "test@example.com", subject: "Test", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/send-email — valid key returns 200", async ({ request }) => {
    const { apiKey } = await signupUser("http://localhost:8787");
    const res = await request.post("/api/send-email", {
      headers: { "X-API-AUTH-KEY": apiKey, "Content-Type": "application/json" },
      data: { to: "test@example.com", subject: "Test", content: "<p>test</p>" },
    });
    // Should return 200 (accepted for sending) even though no vendors configured
    // The email will fail silently in background — that's expected
    expect(res.status()).toBe(200);
  });
});
