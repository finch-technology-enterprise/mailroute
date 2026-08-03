import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adapterSend: vi.fn(),
  updates: [] as Array<Record<string, unknown>>,
}));

vi.mock("../services/email-vendor.service", () => ({
  EmailVendorService: class {
    async getActiveVendors() {
      return [
        {
          id: "vendor-1",
          name: "sender",
          apiEndpoint: "https://api.example.test/send",
          apiToken: "token",
          fromEmail: "from@example.com",
          fromName: "Sender",
          config: null,
        },
      ];
    }
  },
}));

vi.mock("../vendors", () => ({
  ADAPTERS: {
    sender: { name: "sender", send: mocks.adapterSend },
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({
          all: async () => [
            {
              id: "scheduled-1",
              tenantId: "tenant-1",
              payload: JSON.stringify({
                to: "to@example.com",
                subject: "Scheduled",
                content: "<p>Hi</p>",
              }),
            },
          ],
        }),
      }),
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          execute: async () => {
            mocks.updates.push(value);
          },
        }),
      }),
    }),
  })),
}));

import { scheduled } from "../scheduled";

beforeEach(() => {
  mocks.adapterSend.mockReset();
  mocks.updates.length = 0;
});

describe("scheduled provider message IDs", () => {
  it("persists a nonblank provider message ID when a scheduled send succeeds", async () => {
    mocks.adapterSend.mockResolvedValue({
      providerMessageId: "scheduled-provider-id",
    });
    const pending: Promise<unknown>[] = [];

    await scheduled(
      {} as ScheduledEvent,
      { D1_DATABASE: {} } as never,
      {
        waitUntil(promise: Promise<unknown>) {
          pending.push(promise);
        },
      } as never,
    );
    await Promise.all(pending);

    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        status: "sent",
        providerMessageId: "scheduled-provider-id",
      }),
    );
  });

  it("leaves providerMessageId unchanged when the provider returns a blank ID", async () => {
    mocks.adapterSend.mockResolvedValue({ providerMessageId: " " });
    const pending: Promise<unknown>[] = [];

    await scheduled(
      {} as ScheduledEvent,
      { D1_DATABASE: {} } as never,
      {
        waitUntil(promise: Promise<unknown>) {
          pending.push(promise);
        },
      } as never,
    );
    await Promise.all(pending);

    const sentUpdate = mocks.updates.find((update) => update.status === "sent");
    expect(sentUpdate).not.toHaveProperty("providerMessageId");
  });
});
