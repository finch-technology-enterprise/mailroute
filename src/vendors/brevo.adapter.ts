import { EmailVendorAdapter, SendArgs, SendResult } from "./types";

function getProviderMessageId(data: unknown): string {
  if (typeof data !== "object" || data === null || Array.isArray(data))
    return "";

  const record = data as Record<string, unknown>;
  return typeof record.messageId === "string" ? record.messageId : "";
}

export const brevoAdapter: EmailVendorAdapter = {
  name: "brevo",
  async send({
    endpoint,
    token,
    from,
    to,
    subject,
    html,
    attachments,
    signal,
  }: SendArgs): Promise<SendResult> {
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
      signal,
    });

    if (!response.ok) {
      throw new Error(`Brevo API error: ${await response.text()}`);
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
