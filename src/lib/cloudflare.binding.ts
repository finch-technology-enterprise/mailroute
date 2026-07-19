/**
 * Cloudflare Rate Limiting binding (configured under `ratelimits` in
 * wrangler.jsonc). Defined locally so we don't depend on the type being
 * present in the installed @cloudflare/workers-types version.
 */
export interface RateLimit {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CloudflareBindings {
  // Resolved from the central `service_config` D1 table via ConfigService.
  // Optional here because they are now sourced from D1; any value still set
  // as a Worker secret is used only as a fallback until the row is seeded.
  APP_ENVIRONMENT?: "production" | "staging" | "development";
  APP_URL?: string;
  API_AUTH_KEY?: string;

  NEW_RELIC_LICENSE_KEY?: string;
  NEW_RELIC_LOG_ENDPOINT?: string;

  TIMEZONE?: string;

  /**
   * @deprecated Vendor credentials now live in the email_vendors D1 table.
   * These env bindings are read only as a fallback until the table is seeded.
   */
  SENDER_API_ENDPOINT?: string;
  /**
   * @deprecated Vendor credentials now live in the email_vendors D1 table.
   * These env bindings are read only as a fallback until the table is seeded.
   */
  SENDER_API_TOKEN?: string;

  // True bindings — always present, required to bootstrap config itself.
  D1_DATABASE: D1Database;

  RATE_LIMITER: RateLimit;
}
