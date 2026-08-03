// e2e/webhook.spec.ts
import { createHmac } from "node:crypto";
import { test, expect } from "./fixtures";

const webhookSecret = "playwright-webhook-secret-123456789";

test.describe("Webhook", () => {
  test("POST /api/webhooks/:vendor — signed unknown message returns 404", async ({
    request,
  }) => {
    const payload = {
      messageId: crypto.randomUUID(),
      status: "delivered",
      timestamp: new Date().toISOString(),
    };
    const body = JSON.stringify(payload);
    const signature = createHmac("sha256", webhookSecret)
      .update(body)
      .digest("base64");
    const res = await request.post("/api/webhooks/sendgrid", {
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      data: body,
    });
    expect(res.status()).toBe(404);
  });

  test("POST /api/webhooks/:vendor — invalid status returns 400", async ({
    request,
  }) => {
    const body = JSON.stringify({ messageId: "abc", status: "unknown_status" });
    const signature = createHmac("sha256", webhookSecret)
      .update(body)
      .digest("base64");
    const res = await request.post("/api/webhooks/sendgrid", {
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
      },
      data: body,
    });
    expect(res.status()).toBe(400);
  });
});
