import { EmailVendorAdapter, SendArgs, SendResult } from "./types";

export const senderAdapter: EmailVendorAdapter = {
  name: "sender",
  async send({ endpoint, token, from, to, subject, html, signal }: SendArgs): Promise<SendResult> {
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

    // Try to extract provider message ID from response
    let providerMessageId = "";
    try {
      const data = await response.json();
      providerMessageId = data.id || data.messageId || data.message_id || "";
    } catch {
      // Response may not be JSON or may not have an ID - that's okay
    }

    return {
      providerMessageId,
      metadata: {},
    };
  },
};
