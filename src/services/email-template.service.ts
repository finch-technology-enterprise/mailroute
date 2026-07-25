import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { EmailTemplate } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { createCachedLoader } from "../utils/cache.util";

const CACHE_TTL_MS = 60_000;

const templateLoaders = new Map<
  string,
  ReturnType<typeof createCachedLoader<Record<string, { subject: string; content: string }>>>
>();

function getLoader(env: CloudflareBindings, tenantId: string) {
  const key = `${tenantId}`;
  let loader = templateLoaders.get(key);
  if (!loader) {
    const db = drizzle(env.D1_DATABASE);
    loader = createCachedLoader(async () => {
      const rows = await db
        .select()
        .from(EmailTemplate)
        .where(eq(EmailTemplate.tenantId, tenantId))
        .all();
      const map: Record<string, { subject: string; content: string }> = {};
      for (const row of rows) {
        map[row.slug] = { subject: row.subject, content: row.content };
      }
      return map;
    }, CACHE_TTL_MS);
    templateLoaders.set(key, loader);
  }
  return loader;
}

export class EmailTemplateService {
  private db;
  private tenantId: string;
  private loader: ReturnType<typeof createCachedLoader<Record<string, { subject: string; content: string }>>>;

  constructor(env: CloudflareBindings, tenantId: string) {
    this.db = drizzle(env.D1_DATABASE);
    this.tenantId = tenantId;
    this.loader = getLoader(env, tenantId);
  }

  static invalidateCache(tenantId?: string): void {
    if (tenantId) {
      templateLoaders.delete(tenantId);
    } else {
      templateLoaders.clear();
    }
  }

  async getProcessedTemplate(
    slug: string,
    replacements: Record<string, string>,
  ) {
    const templates = await this.loader.get();
    const template = templates[slug];
    if (!template) return null;

    let processedSubject = template.subject;
    let processedContent = template.content;

    Object.entries(replacements).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      processedSubject = processedSubject.split(token).join(value);
      processedContent = processedContent.split(token).join(value);
    });

    return {
      subject: processedSubject,
      content: processedContent,
    };
  }
}
