import { drizzle } from "drizzle-orm/d1";
import { and, eq, inArray } from "drizzle-orm";
import { ServiceConfig } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { TimedCache } from "../utils/cache.util";

const SERVICE_NAME = "email-microservice";

export type ConfigKey =
  | "API_AUTH_KEY"
  | "NEW_RELIC_LICENSE_KEY"
  | "NEW_RELIC_LOG_ENDPOINT"
  | "APP_ENVIRONMENT"
  | "APP_URL";

const CACHE_TTL_MS = 60_000;

const caches = new Map<string, TimedCache<Record<string, string>>>();

export class ConfigService {
  private db;
  private tenantId: string;

  constructor(private env: CloudflareBindings, tenantId: string) {
    this.db = drizzle(env.D1_DATABASE);
    this.tenantId = tenantId;
  }

  async load(): Promise<Record<string, string>> {
    const now = Date.now();
    const cacheKey = this.tenantId || "__system__";
    const cached = caches.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value;

    const conditions = [
      inArray(ServiceConfig.service, [SERVICE_NAME, "*"]),
    ];
    if (this.tenantId) {
      conditions.push(eq(ServiceConfig.tenantId, this.tenantId));
    }

    const rows = await this.db
      .select()
      .from(ServiceConfig)
      .where(and(...conditions))
      .all();

    const shared: Record<string, string> = {};
    const specific: Record<string, string> = {};
    for (const row of rows) {
      (row.service === "*" ? shared : specific)[row.key] = row.value;
    }

    const merged = { ...shared, ...specific };
    caches.set(cacheKey, { value: merged, expiresAt: now + CACHE_TTL_MS });
    return merged;
  }

  async get(key: ConfigKey): Promise<string> {
    const config = await this.load();
    if (config[key] !== undefined) return config[key];
    const fallback = (this.env as unknown as Record<string, unknown>)[key];
    return typeof fallback === "string" ? fallback : "";
  }

  static clearCache(): void {
    caches.clear();
  }

  static invalidateCache(): void {
    caches.clear();
  }
}
