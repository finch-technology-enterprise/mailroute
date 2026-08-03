import { afterEach, describe, expect, it, vi } from "vitest";
import { brevoAdapter } from "../vendors/brevo.adapter";
import { senderAdapter } from "../vendors/sender.adapter";
import type { SendArgs } from "../vendors/types";

const baseArgs: SendArgs = {
  endpoint: "https://api.example.test/send",
  token: "test-token",
  from: { email: "sender@example.com", name: "Example Sender" },
  to: "recipient@example.com",
  subject: "Test email",
  html: "<p>Hello</p>",
  config: {},
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("brevoAdapter", () => {
  it("returns the provider message ID and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messageId: "brevo-message-id" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await brevoAdapter.send({ ...baseArgs, signal });

    expect(result).toEqual({
      providerMessageId: "brevo-message-id",
      metadata: {},
    });
    expect(fetchMock).toHaveBeenCalledWith(
      baseArgs.endpoint,
      expect.objectContaining({ signal }),
    );
  });

  it("returns an empty provider message ID for an unexpected response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(["unexpected"]), { status: 201 }),
        ),
    );

    await expect(brevoAdapter.send(baseArgs)).resolves.toEqual({
      providerMessageId: "",
      metadata: {},
    });
  });
});

describe("senderAdapter", () => {
  it("returns the provider message ID and forwards the abort signal", async () => {
    const signal = new AbortController().signal;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message_id: "sender-message-id" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await senderAdapter.send({ ...baseArgs, signal });

    expect(result).toEqual({
      providerMessageId: "sender-message-id",
      metadata: {},
    });
    expect(fetchMock).toHaveBeenCalledWith(
      baseArgs.endpoint,
      expect.objectContaining({ signal }),
    );
  });

  it("returns Sender.net's emailId response field", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ emailId: "sender-email-id" }), {
          status: 200,
        }),
      ),
    );

    await expect(senderAdapter.send(baseArgs)).resolves.toEqual({
      providerMessageId: "sender-email-id",
      metadata: {},
    });
  });

  it("returns an empty provider message ID for an unexpected response body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify("unexpected"), { status: 200 }),
        ),
    );

    await expect(senderAdapter.send(baseArgs)).resolves.toEqual({
      providerMessageId: "",
      metadata: {},
    });
  });
});
