/** Normalized inputs every vendor adapter receives for a single send. */
export interface SendArgs {
  endpoint: string;
  token: string;
  from: { email: string; name: string };
  to: string;
  subject: string;
  html: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
  /** Parsed from the vendor row's JSON `config` column; {} when null. */
  config: Record<string, unknown>;
  /** Abort signal for request cancellation on timeout */
  signal?: AbortSignal;
}

/** Result of a successful send from a vendor adapter. */
export interface SendResult {
  /** The provider-assigned message ID for webhook correlation */
  providerMessageId: string;
  /** Any additional metadata the provider returns */
  metadata?: Record<string, unknown>;
}

/** A vendor implementation. `send` throws on a non-2xx response. */
export interface EmailVendorAdapter {
  readonly name: string;
  send(args: SendArgs): Promise<SendResult>;
}
