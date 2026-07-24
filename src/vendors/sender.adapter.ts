import { EmailVendorAdapter, SendArgs } from "./types";

export const senderAdapter: EmailVendorAdapter = {
  name: "sender",
  async send({ endpoint, token, from, to, subject, html }: SendArgs) {
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
    });

    if (!response.ok) {
      throw new Error(`Sender.net API error: ${await response.text()}`);
    }
  },
};
