import { EmailVendorAdapter, SendArgs } from "./types";

export const brevoAdapter: EmailVendorAdapter = {
  name: "brevo",
  async send({ endpoint, token, from, to, subject, html, attachments }: SendArgs) {
    const body: Record<string, unknown> = {
      sender: { email: from.email, ...(from.name ? { name: from.name } : {}) },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };

    if (attachments && attachments.length > 0) {
      body.attachment = attachments.map((a) => ({
        name: a.filename,
        content: a.content,
        contentType: a.contentType || "application/octet-stream",
      }));
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": token,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Brevo API error: ${await response.text()}`);
    }
  },
};
