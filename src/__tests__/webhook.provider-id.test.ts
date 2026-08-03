import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  lookupWhere: undefined as unknown,
  updateWhere: undefined as unknown,
  updateSet: undefined as unknown,
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: { name?: string }, value: unknown) => ({
    op: "eq",
    column: column.name,
    value,
  }),
  and: (...conditions: unknown[]) => ({ op: "and", conditions }),
  asc: (column: { name?: string }) => ({ op: "asc", column: column.name }),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          mocks.lookupWhere = condition;
          return {
            get: async () => ({
              id: "local-log-id",
              tenantId: "tenant-1",
              vendorId: "vendor-1",
              vendorName: "sender",
              toEmail: "to@example.com",
              subject: "Hello",
              status: "sent",
              error: null,
              providerMessageId: "provider-123",
              createdAt: "2026-01-01T00:00:00.000Z",
            }),
          };
        },
      }),
    }),
    update: () => ({
      set: (value: unknown) => {
        mocks.updateSet = value;
        return {
          where: (condition: unknown) => {
            mocks.updateWhere = condition;
            return { execute: async () => undefined };
          },
        };
      },
    }),
  })),
}));

vi.mock("../services/email.service", () => ({
  EmailService: class {},
}));

import webhook from "../routes/webhook.routes";

async function sign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

beforeEach(() => {
  mocks.lookupWhere = undefined;
  mocks.updateWhere = undefined;
  mocks.updateSet = undefined;
});

describe("webhook provider message ID correlation", () => {
  it("looks up by provider ID and vendor, then updates by the local log ID", async () => {
    const body = JSON.stringify({
      messageId: "provider-123",
      status: "delivered",
    });
    const secret = "webhook-secret";

    const response = await webhook.request(
      "https://example.test/sender",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Webhook-Signature": await sign(body, secret),
        },
        body,
      },
      { WEBHOOK_SECRET: secret, D1_DATABASE: {} } as never,
      { waitUntil: vi.fn() } as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    expect(mocks.lookupWhere).toEqual({
      op: "and",
      conditions: [
        { op: "eq", column: "provider_message_id", value: "provider-123" },
        { op: "eq", column: "vendor_name", value: "sender" },
      ],
    });
    expect(mocks.updateSet).toEqual({ status: "delivered" });
    expect(mocks.updateWhere).toEqual({
      op: "eq",
      column: "id",
      value: "local-log-id",
    });
  });
});
