// e2e/email.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Email Sending", () => {
  let apiKey: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    apiKey = data.apiKey;
  });

  const headers = () => ({
    "X-API-AUTH-KEY": apiKey,
    "Content-Type": "application/json",
  });

  test("GET /api/health — returns healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  test("POST /api/send-email — valid payload returns 200", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: headers(),
      data: { to: "user@example.com", subject: "Hello", content: "<p>World</p>" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.sendId).toBeTruthy();
  });

  test("POST /api/send-email — invalid email returns 400", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: headers(),
      data: { to: "not-an-email", subject: "Test", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/send-email — missing subject returns 400", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: headers(),
      data: { to: "user@example.com", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/send-template — missing template returns 404", async ({ request }) => {
    const res = await request.post("/api/send-template", {
      headers: headers(),
      data: { to: "user@example.com", template: "nonexistent" },
    });
    expect(res.status()).toBe(404);
  });

  test("POST /api/send-batch — valid batch returns 200 with sendIds", async ({ request }) => {
    const res = await request.post("/api/send-batch", {
      headers: headers(),
      data: {
        emails: [
          { to: "a@example.com", subject: "A", content: "<p>A</p>" },
          { to: "b@example.com", subject: "B", content: "<p>B</p>" },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.sendIds).toHaveLength(2);
  });

  test("POST /api/send-batch — over limit returns 400", async ({ request }) => {
    const emails = Array.from({ length: 51 }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: `Test ${i}`,
      content: "<p>test</p>",
    }));
    const res = await request.post("/api/send-batch", {
      headers: headers(),
      data: { emails },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/send-otp — valid OTP returns 200", async ({ request }) => {
    const res = await request.post("/api/send-otp", {
      headers: headers(),
      data: { to: "user@example.com", otp: "123456" },
    });
    // Returns 200 even if no template — send happens in background
    expect(res.status()).toBe(200);
  });
});
