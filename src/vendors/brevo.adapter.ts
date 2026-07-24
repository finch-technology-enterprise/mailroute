import { EmailVendorAdapter, SendArgs } from "./types";

export const brevoAdapter: EmailVendorAdapter = {
  name: "brevo",
  async send({ endpoint, token, from, to, subject, html }: SendArgs) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": token,
      },
      body: JSON.stringify({
        sender: { email: from.email, ...(from.name ? { name: from.name } : {}) },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo API error: ${await response.text()}`);
    }
  },
};
