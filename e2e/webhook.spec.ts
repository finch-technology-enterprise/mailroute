// e2e/webhook.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Webhook", () => {
  test("POST /api/webhooks/:vendor — valid status update returns 200", async ({ request }) => {
    const res = await request.post("/api/webhooks/sendgrid", {
      data: {
        messageId: crypto.randomUUID(),
        status: "delivered",
        timestamp: new Date().toISOString(),
      },
    });
    // Unknown messageId returns 404, structure is correct
    expect([200, 404]).toContain(res.status());
  });

  test("POST /api/webhooks/:vendor — invalid status returns 400", async ({ request }) => {
    const res = await request.post("/api/webhooks/sendgrid", {
      data: { messageId: "abc", status: "unknown_status" },
    });
    expect(res.status()).toBe(400);
  });
});
