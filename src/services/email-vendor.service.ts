import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc } from "drizzle-orm";
import { EmailVendor, EmailVendorRow } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { TimedCache } from "../utils/cache.util";

const CACHE_TTL_MS = 60_000;

let cache: TimedCache<EmailVendorRow[]> | null = null;

export class EmailVendorService {
  private db;
  private tenantId: string;

  constructor(env: CloudflareBindings, tenantId: string) {
    this.db = drizzle(env.D1_DATABASE);
    this.tenantId = tenantId;
  }

  async getActiveVendors(): Promise<EmailVendorRow[]> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.value;

    const rows = await this.db
      .select()
      .from(EmailVendor)
      .where(and(eq(EmailVendor.enabled, true), eq(EmailVendor.tenantId, this.tenantId)))
      .orderBy(asc(EmailVendor.priority))
      .all();

    cache = { value: rows, expiresAt: now + CACHE_TTL_MS };
    return rows;
  }

  static clearCache(): void {
    cache = null;
  }

  static invalidateCache(): void {
    cache = null;
  }
}
