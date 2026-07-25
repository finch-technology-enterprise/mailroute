// e2e/admin.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Admin CRUD", () => {
  let token: string;
  let vendorId: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    token = data.token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  test("GET /api/admin/vendors — returns empty list", async ({ request }) => {
    const res = await request.get("/api/admin/vendors", { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("POST /api/admin/vendors — creates vendor", async ({ request }) => {
    const res = await request.post("/api/admin/vendors", {
      headers: auth(),
      data: {
        name: "sendgrid",
        enabled: true,
        priority: 1,
        apiEndpoint: "https://api.sendgrid.com/v3/mail/send",
        apiToken: "test-token",
        fromEmail: "noreply@example.com",
        fromName: "Test",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    vendorId = body.data.id;
    expect(body.data.name).toBe("sendgrid");
  });

  test("PUT /api/admin/vendors/:id — updates vendor", async ({ request }) => {
    const res = await request.put(`/api/admin/vendors/${vendorId}`, {
      headers: auth(),
      data: { priority: 2 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.priority).toBe(2);
  });

  test("DELETE /api/admin/vendors/:id — deletes vendor", async ({ request }) => {
    const res = await request.delete(`/api/admin/vendors/${vendorId}`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
  });

  test("POST /api/admin/templates — creates template", async ({ request }) => {
    const res = await request.post("/api/admin/templates", {
      headers: auth(),
      data: { slug: "welcome", subject: "Welcome {{name}}", content: "<p>Hi {{name}}</p>" },
    });
    expect(res.status()).toBe(201);
  });

  test("POST /api/admin/templates/:id/preview — renders template", async ({ request }) => {
    // Create first
    await request.post("/api/admin/templates", {
      headers: auth(),
      data: { slug: "preview-test", subject: "Hi {{name}}", content: "<p>{{name}}</p>" },
    });
    const res = await request.post("/api/admin/templates/preview-test/preview", {
      headers: auth(),
      data: { replacements: { name: "Alice" } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.subject).toBe("Hi Alice");
    expect(body.data.content).toBe("<p>Alice</p>");
  });

  test("POST /api/admin/api-keys — creates and returns key", async ({ request }) => {
    const res = await request.post("/api/admin/api-keys", {
      headers: auth(),
      data: { name: "Test Key" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.rawKey).toMatch(/^mr_/);
  });

  test("GET /api/admin/stats — returns stats", async ({ request }) => {
    const res = await request.get("/api/admin/stats", {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.data.vendorCount).toBe("number");
    expect(typeof body.data.templateCount).toBe("number");
  });

  test("GET /api/admin/logs — returns merged logs", async ({ request }) => {
    const res = await request.get("/api/admin/logs", {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
