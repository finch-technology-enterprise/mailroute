import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendLogMatches: [] as Array<Record<string, unknown>>,
  emailVendorRows: [] as Array<Record<string, unknown>>,
  updateSet: undefined as unknown,
  updateWhere: undefined as unknown,
  insertedEvents: [] as Array<Record<string, unknown>>,
  seenIdempotencyKeys: new Set<string>(),
  emailServiceSend: vi.fn(),
  selectCallIndex: 0,
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
    select: () => {
      // The route makes at most two select() calls per request, always in
      // this order: SendLog correlation lookup, then (only on retry)
      // EmailVendor lookup. Index by call order rather than table identity
      // to keep this mock simple.
      const idx = mocks.selectCallIndex++;
      return {
        from: () => ({
          where: () => ({
            all: async () =>
              idx === 0 ? mocks.sendLogMatches : mocks.emailVendorRows,
            orderBy: () => ({
              all: async () => mocks.emailVendorRows,
            }),
          }),
        }),
      };
    },
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        execute: async () => {
          const key = value.idempotencyKey as string;
          if (mocks.seenIdempotencyKeys.has(key)) {
            throw new Error(
              "UNIQUE constraint failed: delivery_events.idempotency_key",
            );
          }
          mocks.seenIdempotencyKeys.add(key);
          mocks.insertedEvents.push(value);
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
  EmailService: class {
    sendEmail(...args: unknown[]) {
      return mocks.emailServiceSend(...args);
    }
  },
}));

vi.mock("../utils/helpers.util", () => ({
  LogToNewRelic: vi.fn(),
}));

import webhook from "../routes/webhook.routes";
import { LogToNewRelic } from "../utils/helpers.util";

const secret = "webhook-secret";

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

function defaultLog(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

async function postWebhook(payload: Record<string, unknown>) {
  mocks.selectCallIndex = 0;
  const body = JSON.stringify(payload);
  const pending: Promise<unknown>[] = [];
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
    { waitUntil: (p: Promise<unknown>) => pending.push(p) } as never,
  );
  // The retry-on-failure side effect runs via executionCtx.waitUntil, i.e.
  // after the response is already returned — await it so assertions about
  // that side effect are deterministic instead of racing the response.
  await Promise.all(pending);
  return response;
}

beforeEach(() => {
  mocks.sendLogMatches = [defaultLog()];
  mocks.emailVendorRows = [];
  mocks.updateSet = undefined;
  mocks.updateWhere = undefined;
  mocks.insertedEvents.length = 0;
  mocks.seenIdempotencyKeys.clear();
  mocks.emailServiceSend.mockReset();
  mocks.selectCallIndex = 0;
});

describe("webhook provider message ID correlation", () => {
  it("looks up by provider ID and vendor", async () => {
    const response = await postWebhook({
      messageId: "provider-123",
      status: "delivered",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
  });

  it("does not touch SendLog.status on a delivered confirmation (column only allows sent/failed)", async () => {
    await postWebhook({ messageId: "provider-123", status: "delivered" });

    expect(mocks.updateSet).toBeUndefined();
    expect(mocks.insertedEvents).toContainEqual(
      expect.objectContaining({
        eventType: "delivered",
        providerMessageId: "provider-123",
      }),
    );
  });

  it("marks the log failed on a bounce", async () => {
    await postWebhook({ messageId: "provider-123", status: "bounced" });

    expect(mocks.updateSet).toEqual({
      status: "failed",
      error: "sender reported: bounced",
    });
    expect(mocks.updateWhere).toEqual({
      op: "eq",
      column: "id",
      value: "local-log-id",
    });
  });

  it("returns 404 for an unknown message", async () => {
    mocks.sendLogMatches = [];

    const response = await postWebhook({
      messageId: "no-such-id",
      status: "delivered",
    });

    expect(response.status).toBe(404);
  });

  it("refuses to guess when the same vendorName+messageId matches more than one tenant's log", async () => {
    mocks.sendLogMatches = [
      defaultLog({ id: "log-tenant-a", tenantId: "tenant-a" }),
      defaultLog({ id: "log-tenant-b", tenantId: "tenant-b" }),
    ];

    const response = await postWebhook({
      messageId: "provider-123",
      status: "bounced",
    });

    expect(response.status).toBe(409);
    expect(mocks.updateSet).toBeUndefined();
    expect(LogToNewRelic).toHaveBeenCalledWith(
      expect.anything(),
      "webhook:ambiguous-correlation",
      expect.objectContaining({ level: "ERROR" }),
    );
  });
});

describe("webhook idempotency", () => {
  beforeEach(() => {
    mocks.sendLogMatches = [defaultLog({ vendorId: "vendor-1" })];
    mocks.emailVendorRows = [
      { id: "vendor-1", name: "sender", enabled: true, priority: 1 },
      { id: "vendor-2", name: "brevo", enabled: true, priority: 2 },
    ];
    mocks.emailServiceSend.mockResolvedValue({ providerMessageId: "retry-id" });
  });

  it("sends exactly one retry even when the same bounce event is redelivered", async () => {
    const first = await postWebhook({
      messageId: "provider-123",
      status: "bounced",
    });
    const second = await postWebhook({
      messageId: "provider-123",
      status: "bounced",
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mocks.emailServiceSend).toHaveBeenCalledTimes(1);
  });

  it("treats a different status for the same message as a distinct event", async () => {
    await postWebhook({ messageId: "provider-123", status: "sent" });
    await postWebhook({ messageId: "provider-123", status: "bounced" });

    expect(mocks.insertedEvents).toHaveLength(2);
    expect(mocks.emailServiceSend).toHaveBeenCalledTimes(1);
  });
});
