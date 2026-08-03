import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SendResult } from "../vendors/types";

const mocks = vi.hoisted(() => ({
  activeVendors: [] as Array<Record<string, unknown>>,
  adapterSend: vi.fn(),
  insertedLogs: [] as Array<Record<string, unknown>>,
  insertGate: undefined as Promise<void> | undefined,
}));

vi.mock("../services/email-vendor.service", () => ({
  EmailVendorService: class {
    async getActiveVendors() {
      return mocks.activeVendors;
    }
  },
}));

vi.mock("../vendors", () => ({
  ADAPTERS: {
    sender: { name: "sender", send: mocks.adapterSend },
  },
}));

vi.mock("../services/push.service", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/helpers.util", () => ({
  LogToNewRelic: vi.fn(),
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: () => ({
      from: () => ({
        where: () => ({ all: async () => [] }),
      }),
    }),
    insert: () => ({
      values: (value: Record<string, unknown>) => ({
        execute: async () => {
          await mocks.insertGate;
          mocks.insertedLogs.push(value);
        },
      }),
    }),
  })),
}));

import { EmailService } from "../services/email.service";

const vendor = {
  id: "vendor-1",
  tenantId: "tenant-1",
  name: "sender",
  enabled: true,
  priority: 1,
  apiEndpoint: "https://api.example.test/send",
  apiToken: "token",
  fromEmail: "from@example.com",
  fromName: "Sender",
  config: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function createContext() {
  const pending: Promise<unknown>[] = [];
  return {
    env: { D1_DATABASE: {} },
    executionCtx: {
      waitUntil(promise: Promise<unknown>) {
        pending.push(promise);
      },
    },
    pending,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("EmailService provider message IDs", () => {
  beforeEach(() => {
    mocks.activeVendors = [vendor];
    mocks.adapterSend.mockReset();
    mocks.insertedLogs.length = 0;
    mocks.insertGate = undefined;
  });

  it("returns the adapter SendResult and persists its nonblank provider message ID", async () => {
    const sendResult: SendResult = {
      providerMessageId: "provider-123",
      metadata: { requestId: "request-1" },
    };
    mocks.adapterSend.mockResolvedValue(sendResult);
    const c = createContext();

    const result = await new EmailService(c.env as never, "tenant-1").sendEmail(
      c as never,
      { to: "to@example.com", subject: "Hello", content: "<p>Hi</p>" },
    );
    await Promise.all(c.pending);

    expect(result).toBe(sendResult);
    expect(mocks.adapterSend).toHaveBeenCalledWith(
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.insertedLogs).toContainEqual(
      expect.objectContaining({
        status: "sent",
        providerMessageId: "provider-123",
      }),
    );
  });

  it("does not resolve before the successful send log is persisted", async () => {
    let releaseInsert!: () => void;
    mocks.insertGate = new Promise<void>((resolve) => {
      releaseInsert = resolve;
    });
    mocks.adapterSend.mockResolvedValue({
      providerMessageId: "provider-123",
    });
    const c = createContext();
    let resolved = false;

    const sendPromise = new EmailService(c.env as never, "tenant-1")
      .sendEmail(c as never, {
        to: "to@example.com",
        subject: "Hello",
        content: "<p>Hi</p>",
      })
      .then((result) => {
        resolved = true;
        return result;
      });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(resolved).toBe(false);
    releaseInsert();
    await expect(sendPromise).resolves.toEqual({
      providerMessageId: "provider-123",
    });
  });

  it("does not persist a blank provider message ID", async () => {
    mocks.adapterSend.mockResolvedValue({ providerMessageId: "   " });
    const c = createContext();

    await new EmailService(c.env as never, "tenant-1").sendEmail(c as never, {
      to: "to@example.com",
      subject: "Hello",
      content: "<p>Hi</p>",
    });
    await Promise.all(c.pending);

    expect(mocks.insertedLogs[0]).not.toHaveProperty("providerMessageId");
  });

  it("returns and persists the SendResult from a successful retry", async () => {
    vi.useFakeTimers();
    const retryResult: SendResult = { providerMessageId: "retry-provider-id" };
    mocks.adapterSend
      .mockRejectedValueOnce(new Error("network error"))
      .mockResolvedValueOnce(retryResult);
    const c = createContext();

    const sendPromise = new EmailService(c.env as never, "tenant-1").sendEmail(
      c as never,
      { to: "to@example.com", subject: "Hello", content: "<p>Hi</p>" },
    );
    await vi.runAllTimersAsync();
    const result = await sendPromise;
    await Promise.all(c.pending);

    expect(result).toBe(retryResult);
    expect(mocks.insertedLogs).toContainEqual(
      expect.objectContaining({
        status: "sent",
        providerMessageId: "retry-provider-id",
      }),
    );
  });

  it("aborts each provider request when its timeout expires", async () => {
    vi.useFakeTimers();
    const signals: AbortSignal[] = [];
    mocks.adapterSend.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise<never>((_, reject) => {
          signals.push(signal);
          signal.addEventListener("abort", () =>
            reject(new Error("network error after abort")),
          );
        }),
    );
    const c = createContext();

    const sendPromise = new EmailService(c.env as never, "tenant-1").sendEmail(
      c as never,
      { to: "to@example.com", subject: "Hello", content: "<p>Hi</p>" },
    );
    const rejection = expect(sendPromise).rejects.toThrow(
      "All email vendors failed",
    );
    await vi.runAllTimersAsync();

    await rejection;
    expect(signals).toHaveLength(4);
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });
});
