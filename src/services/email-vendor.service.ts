// src/services/email-vendor.service.ts
import { drizzle } from "drizzle-orm/d1";
import { eq, asc } from "drizzle-orm";
import { EmailVendor, EmailVendorRow } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";

const CACHE_TTL_MS = 60_000; // 60s — edits in D1 go live within a minute.

// Module-level cache: a Worker isolate is reused across many requests, so
// this avoids a D1 read on every send while still picking up vendor changes.
let cache: { value: EmailVendorRow[]; expiresAt: number } | null = null;

export class EmailVendorService {
  private db;

  constructor(env: CloudflareBindings) {
    this.db = drizzle(env.D1_DATABASE);
  }

  /** Enabled vendors, ordered by ascending priority (failover chain). */
  async getActiveVendors(): Promise<EmailVendorRow[]> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) return cache.value;

    const rows = await this.db
      .select()
      .from(EmailVendor)
      .where(eq(EmailVendor.enabled, true))
      .orderBy(asc(EmailVendor.priority))
      .all();

    cache = { value: rows, expiresAt: now + CACHE_TTL_MS };
    return rows;
  }

  /** Clears the in-memory cache (mainly for tests). */
  static clearCache(): void {
    cache = null;
  }
}
