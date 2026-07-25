import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc, desc } from "drizzle-orm";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { requireAuth } from "./auth.routes";
import { RateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import {
  EmailVendor,
  EmailTemplate,
  SendLog,
  ActivityLog,
  PushSubscription,
  ApiKey,
} from "../db/schema";
import { EmailService } from "../services/email.service";
import { EmailVendorService } from "../services/email-vendor.service";
import { generateApiKey, hashApiKey } from "../lib/password";
import type { AppEnv } from "../lib/app-env";

const admin = new Hono<AppEnv>();

async function logActivity(c: CloudflareBindings, type: string, summary: string, detail?: string, tenantId?: string) {
  try {
    await drizzle(c.D1_DATABASE).insert(ActivityLog).values({
      id: crypto.randomUUID(),
      tenantId: tenantId || "",
      type,
      summary,
      detail: detail || null,
      createdAt: new Date().toISOString(),
    }).execute();
  } catch {}
}

admin.use("*", requireAuth);
admin.use("*", RateLimitMiddleware);

// --- Vendors ---

admin.get("/vendors", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const rows = await db
    .select()
    .from(EmailVendor)
    .where(eq(EmailVendor.tenantId, tenantId))
    .orderBy(asc(EmailVendor.priority))
    .all();
  return c.json(ApiResponse(true, null, rows));
});

const vendorSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-_]+$/),
  enabled: z.coerce.boolean().default(true),
  priority: z.coerce.number().int().min(1).max(999),
  apiEndpoint: z.string().url().max(512),
  apiToken: z.string().min(1).max(2048),
  fromEmail: z.string().email().max(254),
  fromName: z.string().max(128).default(""),
  config: z.string().optional().refine((val) => {
    if (!val) return true;
    try { JSON.parse(val); return true; } catch { return false; }
  }, "Config must be valid JSON"),
});

admin.post("/vendors", zValidator("json", vendorSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const data = c.req.valid("json");
  const id = data.name;
  await db
    .insert(EmailVendor)
    .values({ id, tenantId, ...data })
    .execute();
  EmailVendorService.invalidateCache(tenantId);
  const row = await db
    .select()
    .from(EmailVendor)
    .where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId)))
    .get();
  await logActivity(c.env, "vendor_created", `Vendor "${data.name}" created`, undefined, tenantId);
  return c.json(ApiResponse(true, "Vendor created", row), 201);
});

const vendorUpdateSchema = vendorSchema.partial();

admin.put("/vendors/:id", zValidator("json", vendorUpdateSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const data = c.req.valid("json");
  await db
    .update(EmailVendor)
    .set(data)
    .where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId)))
    .execute();
  EmailVendorService.invalidateCache(tenantId);
  const row = await db
    .select()
    .from(EmailVendor)
    .where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId)))
    .get();
  if (!row) return c.json(ApiResponse(false, "Vendor not found"), 404);
  await logActivity(c.env, "vendor_updated", `Vendor "${id}" updated`, undefined, tenantId);
  return c.json(ApiResponse(true, "Vendor updated", row));
});

admin.delete("/vendors/:id", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(EmailVendor)
    .where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId)))
    .get();
  if (!existing) return c.json(ApiResponse(false, "Vendor not found"), 404);
  await db.delete(EmailVendor).where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId))).execute();
  EmailVendorService.invalidateCache(tenantId);
  await logActivity(c.env, "vendor_deleted", `Vendor "${id}" deleted`, undefined, tenantId);
  return c.json(ApiResponse(true, "Vendor deleted"));
});

// --- Templates ---

admin.get("/templates", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const rows = await db.select().from(EmailTemplate).where(eq(EmailTemplate.tenantId, tenantId)).all();
  return c.json(ApiResponse(true, null, rows));
});

const templateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9-]+$/),
  subject: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
});

const templateUpdateSchema = templateSchema.partial();

admin.post("/templates", zValidator("json", templateSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const data = c.req.valid("json");
  const id = data.slug;
  await db
    .insert(EmailTemplate)
    .values({ id, tenantId, ...data })
    .execute();
  const row = await db
    .select()
    .from(EmailTemplate)
    .where(and(eq(EmailTemplate.slug, data.slug), eq(EmailTemplate.tenantId, tenantId)))
    .get();
  await logActivity(c.env, "template_created", `Template "${data.slug}" created`, undefined, tenantId);
  return c.json(ApiResponse(true, "Template created", row), 201);
});

admin.put(
  "/templates/:id",
  zValidator("json", templateUpdateSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const data = c.req.valid("json");
    await db
      .update(EmailTemplate)
      .set(data)
      .where(and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)))
      .execute();
    const row = await db
      .select()
      .from(EmailTemplate)
      .where(and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)))
      .get();
    if (!row) return c.json(ApiResponse(false, "Template not found"), 404);
    await logActivity(c.env, "template_updated", `Template "${id}" updated`, undefined, tenantId);
    return c.json(ApiResponse(true, "Template updated", row));
  },
);

admin.delete("/templates/:id", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(EmailTemplate)
    .where(and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)))
    .get();
  if (!existing) return c.json(ApiResponse(false, "Template not found"), 404);
  await db.delete(EmailTemplate).where(and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId))).execute();
  await logActivity(c.env, "template_deleted", `Template "${id}" deleted`, undefined, tenantId);
  return c.json(ApiResponse(true, "Template deleted"));
});

// --- Stats ---

admin.get("/stats", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const vendors = await db.select().from(EmailVendor).where(eq(EmailVendor.tenantId, tenantId)).all();
  const templates = await db.select().from(EmailTemplate).where(eq(EmailTemplate.tenantId, tenantId)).all();
  return c.json(
    ApiResponse(true, null, {
      vendorCount: vendors.length,
      templateCount: templates.length,
    }),
  );
});

// --- Test Send ---

const testSendSchema = z.object({
  to: z.string().email().max(254),
  subject: z.string().min(1).max(255),
  content: z.string().min(1).max(50000),
  vendor: z.string().optional(),
});

admin.post("/test-send", zValidator("json", testSendSchema), async (c) => {
  const { to, subject, content, vendor } = c.req.valid("json");
  const emailService = new EmailService(c.env, c.get("tenantId"));
  try {
    await emailService.sendEmail(c, { to, subject, content }, vendor);
    return c.json(ApiResponse(true, "Email sent"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json(ApiResponse(false, message), 502);
  }
});

// --- Logs ---

admin.get("/logs", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const [sends, activities] = await Promise.all([
    db.select().from(SendLog).where(eq(SendLog.tenantId, tenantId)).orderBy(desc(SendLog.createdAt)).limit(100).all(),
    db.select().from(ActivityLog).where(eq(ActivityLog.tenantId, tenantId)).orderBy(desc(ActivityLog.createdAt)).limit(100).all(),
  ]);
  const mapped = [
    ...sends.map((s) => ({
      id: s.id,
      type: s.status === "sent" ? "email_sent" : "email_failed",
      summary: s.subject,
      detail: `${s.vendorName} → ${s.toEmail}`,
      status: s.status,
      createdAt: s.createdAt,
    })),
    ...activities.map((a) => ({
      id: a.id,
      type: a.type,
      summary: a.summary,
      detail: a.detail || "",
      status: null as string | null,
      createdAt: a.createdAt,
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100);
  return c.json(ApiResponse(true, null, mapped));
});

// --- API Keys ---

const createApiKeySchema = z.object({
  name: z.string().min(1).max(128),
});

admin.get("/api-keys", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const keys = await db
    .select({
      id: ApiKey.id,
      name: ApiKey.name,
      keyPrefix: ApiKey.keyPrefix,
      lastUsedAt: ApiKey.lastUsedAt,
      createdAt: ApiKey.createdAt,
      revokedAt: ApiKey.revokedAt,
    })
    .from(ApiKey)
    .where(eq(ApiKey.tenantId, tenantId))
    .orderBy(desc(ApiKey.createdAt))
    .all();
  return c.json(ApiResponse(true, null, keys));
});

admin.post("/api-keys", zValidator("json", createApiKeySchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const { name } = c.req.valid("json");

  const rawKey = generateApiKey();
  const keyHash = await hashApiKey(rawKey, c.env.CONFIG_ENCRYPTION_KEY);
  const keyPrefix = rawKey.slice(0, 10) + "...";

  await db.insert(ApiKey).values({
    id: crypto.randomUUID(),
    tenantId,
    name,
    keyHash,
    keyPrefix,
  }).execute();

  await logActivity(c.env, "api_key_created", `API key "${name}" created`, undefined, tenantId);

  return c.json(ApiResponse(true, "API key created", { rawKey, name, keyPrefix }), 201);
});

admin.delete("/api-keys/:id", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(ApiKey)
    .where(and(eq(ApiKey.id, id), eq(ApiKey.tenantId, tenantId)))
    .get();

  if (!existing) return c.json(ApiResponse(false, "API key not found"), 404);
  if (existing.revokedAt) return c.json(ApiResponse(false, "API key already revoked"));

  await db.update(ApiKey).set({ revokedAt: new Date().toISOString() }).where(eq(ApiKey.id, id)).execute();

  await logActivity(c.env, "api_key_revoked", `API key "${existing.name}" revoked`, undefined, tenantId);

  return c.json(ApiResponse(true, "API key revoked"));
});

// --- Push Subscriptions ---

admin.post("/push/subscribe", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const body = await c.req.json();
  const { endpoint, keys } = body as { endpoint: string; keys: { p256dh: string; auth: string } };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json(ApiResponse(false, "Invalid subscription"), 400);
  }
  const existing = await db.select().from(PushSubscription)
    .where(and(eq(PushSubscription.endpoint, endpoint), eq(PushSubscription.tenantId, tenantId)))
    .get();
  if (existing) return c.json(ApiResponse(true, "Already subscribed"));
  await db.insert(PushSubscription).values({
    id: crypto.randomUUID(),
    tenantId,
    endpoint,
    p256dhKey: keys.p256dh,
    authKey: keys.auth,
    userAgent: c.req.header("user-agent") || null,
    createdAt: new Date().toISOString(),
  }).execute();
  return c.json(ApiResponse(true, "Subscribed"));
});

admin.delete("/push/subscribe", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const { endpoint } = await c.req.json() as { endpoint: string };
  if (!endpoint) return c.json(ApiResponse(false, "Missing endpoint"), 400);
  await db.delete(PushSubscription)
    .where(and(eq(PushSubscription.endpoint, endpoint), eq(PushSubscription.tenantId, tenantId)))
    .execute();
  return c.json(ApiResponse(true, "Unsubscribed"));
});

export default admin;
