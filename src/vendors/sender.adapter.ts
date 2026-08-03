import { EmailVendorAdapter, SendArgs, SendResult } from "./types";

function getProviderMessageId(data: unknown): string {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return "";

  const record = data as Record<string, unknown>;
  for (const key of ["emailId", "id", "messageId", "message_id"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return "";
}

export const senderAdapter: EmailVendorAdapter = {
  name: "sender",
  async send({
    endpoint,
    token,
    from,
    to,
    subject,
    html,
    signal,
  }: SendArgs): Promise<SendResult> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        from: { email: from.email, ...(from.name ? { name: from.name } : {}) },
        to: { email: to },
        subject,
        html,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Sender.net API error: ${await response.text()}`);
    }

    let providerMessageId = "";
    try {
      providerMessageId = getProviderMessageId(await response.json());
    } catch {
      // A successful response may have no JSON body.
    }

    return { providerMessageId, metadata: {} };
  },
};
