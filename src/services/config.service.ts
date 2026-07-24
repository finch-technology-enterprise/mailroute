// src/services/config.service.ts
import { drizzle } from "drizzle-orm/d1";
import { inArray } from "drizzle-orm";
import { ServiceConfig } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { TimedCache } from "../utils/cache.util";

/**
 * Identifies this microservice's rows in the shared `service_config` table.
 * Rows with service = "*" are shared across every microservice; rows with
 * this name override the shared value for this service.
 */
const SERVICE_NAME = "email-microservice";

/** Keys this service resolves from central config (with env fallback). */
export type ConfigKey =
  | "API_AUTH_KEY"
  | "NEW_RELIC_LICENSE_KEY"
  | "NEW_RELIC_LOG_ENDPOINT"
  | "APP_ENVIRONMENT"
  | "APP_URL";

const CACHE_TTL_MS = 60_000; // 60s — edits in D1 go live within a minute.

// Module-level cache: a Worker isolate is reused across many requests, so
// this avoids a D1 read on every request while still picking up changes.
let cache: TimedCache<Record<string, string>> | null = null;

export class ConfigService {
  private db;

  constructor(private env: CloudflareBindings) {
    this.db = drizzle(env.D1_DATABASE);
  }

  /** Loads (and caches) this service's effective config from D1. */
  async load(): Promise<Record<string, string>> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.value;

    const rows = await this.db
      .select()
      .from(ServiceConfig)
      .where(inArray(ServiceConfig.service, [SERVICE_NAME, "*"]))
      .all();

    // Service-specific rows override shared ("*") rows.
    const shared: Record<string, string> = {};
    const specific: Record<string, string> = {};
    for (const row of rows) {
      (row.service === "*" ? shared : specific)[row.key] = row.value;
    }

    const merged = { ...shared, ...specific };
    cache = { value: merged, expiresAt: now + CACHE_TTL_MS };
    return merged;
  }

  /**
   * Resolves a single config value. Falls back to the env binding of the
   * same name if the key has not been seeded into D1 yet (zero-downtime
   * migration). Returns "" if neither source has it.
   */
  async get(key: ConfigKey): Promise<string> {
    const config = await this.load();
    if (config[key] !== undefined) return config[key];
    const fallback = (this.env as unknown as Record<string, unknown>)[key];
    return typeof fallback === "string" ? fallback : "";
  }

  /** Clears the in-memory cache (mainly for tests). */
  static clearCache(): void {
    cache = null;
  }

  static invalidateCache(): void {
    cache = null;
  }
}
