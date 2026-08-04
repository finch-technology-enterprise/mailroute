import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  adapterSend: vi.fn(),
  updates: [] as Array<Record<string, unknown>>,
  candidates: [] as Array<Record<string, unknown>>,
  claimChanges: 1,
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
          all: async () => mocks.candidates,
        }),
      }),
    }),
    update: () => ({
      set: (value: Record<string, unknown>) => ({
        where: () => ({
          execute: async () => {
            mocks.updates.push(value);
            return { meta: { changes: mocks.claimChanges } };
          },
        }),
      }),
    }),
  })),
}));

import { scheduled } from "../scheduled";

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "scheduled-1",
    tenantId: "tenant-1",
    status: "pending",
    attempt: 0,
    payload: JSON.stringify({
      to: "to@example.com",
      subject: "Scheduled",
      content: "<p>Hi</p>",
    }),
    ...overrides,
  };
}

async function runScheduled() {
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
  return pending;
}

afterEach(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  mocks.adapterSend.mockReset();
  mocks.updates.length = 0;
  mocks.candidates = [baseItem()];
  mocks.claimChanges = 1;
});

describe("scheduled provider message IDs", () => {
  it("persists a nonblank provider message ID when a scheduled send succeeds", async () => {
    mocks.adapterSend.mockResolvedValue({
      providerMessageId: "scheduled-provider-id",
    });

    await Promise.all(await runScheduled());

    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        status: "sent",
        providerMessageId: "scheduled-provider-id",
      }),
    );
  });

  it("leaves providerMessageId unchanged when the provider returns a blank ID", async () => {
    mocks.adapterSend.mockResolvedValue({ providerMessageId: " " });

    await Promise.all(await runScheduled());

    const sentUpdate = mocks.updates.find((update) => update.status === "sent");
    expect(sentUpdate).not.toHaveProperty("providerMessageId");
  });
});

describe("scheduled row claiming", () => {
  it("claims the row before sending, so a concurrent tick can't pick it up mid-send", async () => {
    mocks.adapterSend.mockResolvedValue({ providerMessageId: "id-1" });

    await Promise.all(await runScheduled());

    expect(mocks.updates[0]).toEqual(
      expect.objectContaining({ status: "processing", attempt: 1 }),
    );
  });

  it("skips the send entirely when the claim fails (row already claimed elsewhere)", async () => {
    mocks.claimChanges = 0;
    mocks.adapterSend.mockResolvedValue({ providerMessageId: "id-1" });

    await Promise.all(await runScheduled());

    expect(mocks.adapterSend).not.toHaveBeenCalled();
  });

  it("reclaims a stale processing row that's past the lock window", async () => {
    mocks.candidates = [baseItem({ status: "processing", attempt: 1 })];
    mocks.adapterSend.mockResolvedValue({ providerMessageId: "id-1" });

    await Promise.all(await runScheduled());

    expect(mocks.adapterSend).toHaveBeenCalled();
    expect(mocks.updates[0]).toEqual(
      expect.objectContaining({ status: "processing", attempt: 2 }),
    );
  });

  it("marks the item failed without sending once max attempts are exceeded", async () => {
    mocks.candidates = [baseItem({ attempt: 5 })];

    await Promise.all(await runScheduled());

    expect(mocks.adapterSend).not.toHaveBeenCalled();
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        error: "Max attempts exceeded",
      }),
    );
  });
});

describe("scheduled send timeout", () => {
  it("aborts the vendor request on timeout and marks the item failed instead of leaving it pending", async () => {
    vi.useFakeTimers();
    let sawAbort = false;
    mocks.adapterSend.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => {
            sawAbort = true;
            reject(new Error("network error after abort"));
          });
        }),
    );

    const pending = await runScheduled();
    await vi.runAllTimersAsync();
    await Promise.all(pending);

    // Whichever of the two abort listeners (the adapter's own, or
    // withTimeout's) fires first wins the race and determines the
    // rejection message — what matters is that the abort actually
    // propagated and the item didn't get left "processing" forever.
    expect(sawAbort).toBe(true);
    expect(mocks.updates).toContainEqual(
      expect.objectContaining({ status: "failed" }),
    );
  });
});
