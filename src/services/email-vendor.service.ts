import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc } from "drizzle-orm";
import { EmailVendor, EmailVendorRow } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { createCachedLoader } from "../utils/cache.util";

const CACHE_TTL_MS = 60_000;

const loaders = new Map<string, ReturnType<typeof createCachedLoader<EmailVendorRow[]>>>();

function getLoader(env: CloudflareBindings, tenantId: string) {
  let loader = loaders.get(tenantId);
  if (!loader) {
    const db = drizzle(env.D1_DATABASE);
    loader = createCachedLoader(async () => {
      return db
        .select({
          id: EmailVendor.id,
          tenantId: EmailVendor.tenantId,
          name: EmailVendor.name,
          enabled: EmailVendor.enabled,
          priority: EmailVendor.priority,
          apiEndpoint: EmailVendor.apiEndpoint,
          apiToken: EmailVendor.apiToken,
          fromEmail: EmailVendor.fromEmail,
          fromName: EmailVendor.fromName,
          config: EmailVendor.config,
          createdAt: EmailVendor.createdAt,
          updatedAt: EmailVendor.updatedAt,
        })
        .from(EmailVendor)
        .where(and(eq(EmailVendor.enabled, true), eq(EmailVendor.tenantId, tenantId)))
        .orderBy(asc(EmailVendor.priority))
        .all();
    }, CACHE_TTL_MS);
    loaders.set(tenantId, loader);
  }
  return loader;
}

export class EmailVendorService {
  private loader;

  constructor(env: CloudflareBindings, tenantId: string) {
    this.loader = getLoader(env, tenantId);
  }

  async getActiveVendors(): Promise<EmailVendorRow[]> {
    return this.loader.get();
  }

  static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      loaders.delete(tenantId);
    } else {
      loaders.clear();
    }
  }
}
