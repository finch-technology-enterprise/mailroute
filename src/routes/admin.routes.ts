import { Context, Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc, desc } from "drizzle-orm";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { ApiAuthKeyMiddleware } from "../middlewares/api-auth-key.middleware";
import { RateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import {
  EmailVendor,
  EmailTemplate,
  SendLog,
  ServiceConfig,
} from "../db/schema";
import { EmailService } from "../services/email.service";
import { ConfigService } from "../services/config.service";
import { EmailVendorService } from "../services/email-vendor.service";
import { encrypt, decrypt, isEncrypted, generateSecret } from "../lib/crypto";

type Bindings = { Bindings: CloudflareBindings };
const admin = new Hono<Bindings>();

admin.use("*", ApiAuthKeyMiddleware);
admin.use("*", RateLimitMiddleware);

// --- Vendors ---

admin.get("/vendors", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const rows = await db
    .select()
    .from(EmailVendor)
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
  config: z.string().optional(),
});

admin.post("/vendors", zValidator("json", vendorSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const data = c.req.valid("json");
  const id = data.name;
  await db
    .insert(EmailVendor)
    .values({ id, ...data })
    .execute();
  EmailVendorService.invalidateCache();
  const row = await db
    .select()
    .from(EmailVendor)
    .where(eq(EmailVendor.id, id))
    .get();
  return c.json(ApiResponse(true, "Vendor created", row), 201);
});

const vendorUpdateSchema = vendorSchema.partial();

admin.put("/vendors/:id", zValidator("json", vendorUpdateSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const id = c.req.param("id");
  const data = c.req.valid("json");
  await db
    .update(EmailVendor)
    .set(data)
    .where(eq(EmailVendor.id, id))
    .execute();
  EmailVendorService.invalidateCache();
  const row = await db
    .select()
    .from(EmailVendor)
    .where(eq(EmailVendor.id, id))
    .get();
  if (!row) return c.json(ApiResponse(false, "Vendor not found"), 404);
  return c.json(ApiResponse(true, "Vendor updated", row));
});

admin.delete("/vendors/:id", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(EmailVendor)
    .where(eq(EmailVendor.id, id))
    .get();
  if (!existing) return c.json(ApiResponse(false, "Vendor not found"), 404);
  await db.delete(EmailVendor).where(eq(EmailVendor.id, id)).execute();
  EmailVendorService.invalidateCache();
  return c.json(ApiResponse(true, "Vendor deleted"));
});

// --- Templates ---

admin.get("/templates", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const rows = await db.select().from(EmailTemplate).all();
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
  const data = c.req.valid("json");
  const id = data.slug;
  await db
    .insert(EmailTemplate)
    .values({ id, ...data })
    .execute();
  const row = await db
    .select()
    .from(EmailTemplate)
    .where(eq(EmailTemplate.slug, data.slug))
    .get();
  return c.json(ApiResponse(true, "Template created", row), 201);
});

admin.put(
  "/templates/:id",
  zValidator("json", templateUpdateSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const id = c.req.param("id");
    const data = c.req.valid("json");
    await db
      .update(EmailTemplate)
      .set(data)
      .where(eq(EmailTemplate.id, id))
      .execute();
    const row = await db
      .select()
      .from(EmailTemplate)
      .where(eq(EmailTemplate.id, id))
      .get();
    if (!row) return c.json(ApiResponse(false, "Template not found"), 404);
    return c.json(ApiResponse(true, "Template updated", row));
  },
);

admin.delete("/templates/:id", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(EmailTemplate)
    .where(eq(EmailTemplate.id, id))
    .get();
  if (!existing) return c.json(ApiResponse(false, "Template not found"), 404);
  await db.delete(EmailTemplate).where(eq(EmailTemplate.id, id)).execute();
  return c.json(ApiResponse(true, "Template deleted"));
});

// --- Stats ---

admin.get("/stats", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const vendors = await db.select().from(EmailVendor).all();
  const templates = await db.select().from(EmailTemplate).all();
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
});

admin.post("/test-send", zValidator("json", testSendSchema), async (c) => {
  const { to, subject, content } = c.req.valid("json");
  const emailService = new EmailService(c.env);
  try {
    await emailService.sendEmail(c, { to, subject, content });
    return c.json(ApiResponse(true, "Email sent"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json(ApiResponse(false, message), 502);
  }
});

// --- Config ---

const encKey = (c: Context<{ Bindings: CloudflareBindings }>): string => {
  return c.env.CONFIG_ENCRYPTION_KEY || "";
};

admin.get("/config", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const rows = await db.select().from(ServiceConfig).all();
  const mapped = rows.map((r) => ({
    ...r,
    value:
      r.value.length > 64 && isEncrypted(r.value)
        ? r.value.slice(0, 20) + "…(encrypted)"
        : r.value,
    encrypted: isEncrypted(r.value),
  }));
  return c.json(ApiResponse(true, null, mapped));
});

const configUpsertSchema = z.object({
  value: z.string(),
  key: z.string().min(1).max(128).optional(),
  service: z.string().min(1).max(64).optional(),
});

admin.post(
  "/config",
  zValidator("json", configUpsertSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const { service, key, value } = c.req.valid("json");
    const now = new Date().toISOString();
    await db
      .insert(ServiceConfig)
      .values({ service: service!, key: key!, value, updatedAt: now })
      .onConflictDoUpdate({
        target: [ServiceConfig.service, ServiceConfig.key],
        set: { value, updatedAt: now },
      })
      .execute();
    ConfigService.invalidateCache();
    return c.json(ApiResponse(true, "Config saved"));
  },
);

const configUpdateSchema = z.object({ value: z.string() });

admin.put(
  "/config/:service/:key",
  zValidator("json", configUpdateSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const service = c.req.param("service");
    const key = c.req.param("key");
    const { value } = c.req.valid("json");
    const now = new Date().toISOString();
    await db
      .update(ServiceConfig)
      .set({ value, updatedAt: now })
      .where(and(eq(ServiceConfig.service, service), eq(ServiceConfig.key, key)))
      .execute();
    ConfigService.invalidateCache();
    return c.json(ApiResponse(true, "Config updated"));
  },
);

admin.post("/config/:service/:key/encrypt", async (c) => {
  const key = encKey(c);
  if (!key)
    return c.json(ApiResponse(false, "CONFIG_ENCRYPTION_KEY not set"), 400);
  const db = drizzle(c.env.D1_DATABASE);
  const service = c.req.param("service");
  const k = c.req.param("key");
  const row = await db
    .select()
    .from(ServiceConfig)
    .where(and(eq(ServiceConfig.service, service), eq(ServiceConfig.key, k)))
    .get();
  if (!row) return c.json(ApiResponse(false, "Not found"), 404);
  if (isEncrypted(row.value))
    return c.json(ApiResponse(false, "Already encrypted"));
  const encrypted = await encrypt(row.value, key);
  await db
    .update(ServiceConfig)
    .set({ value: encrypted })
    .where(and(eq(ServiceConfig.service, service), eq(ServiceConfig.key, k)))
    .execute();
  ConfigService.invalidateCache();
  return c.json(ApiResponse(true, "Encrypted"));
});

admin.post("/config/:service/:key/decrypt", async (c) => {
  const key = encKey(c);
  if (!key)
    return c.json(ApiResponse(false, "CONFIG_ENCRYPTION_KEY not set"), 400);
  const db = drizzle(c.env.D1_DATABASE);
  const service = c.req.param("service");
  const k = c.req.param("key");
  const row = await db
    .select()
    .from(ServiceConfig)
    .where(and(eq(ServiceConfig.service, service), eq(ServiceConfig.key, k)))
    .get();
  if (!row) return c.json(ApiResponse(false, "Not found"), 404);
  if (!isEncrypted(row.value))
    return c.json(ApiResponse(false, "Not encrypted"));
  const decrypted = await decrypt(row.value, key);
  return c.json(ApiResponse(true, null, { value: decrypted }));
});

admin.post("/config/:service/:key/rotate", async (c) => {
  const key = encKey(c);
  if (!key)
    return c.json(ApiResponse(false, "CONFIG_ENCRYPTION_KEY not set"), 400);
  const db = drizzle(c.env.D1_DATABASE);
  const service = c.req.param("service");
  const k = c.req.param("key");
  const row = await db
    .select()
    .from(ServiceConfig)
    .where(and(eq(ServiceConfig.service, service), eq(ServiceConfig.key, k)))
    .get();
  if (!row) return c.json(ApiResponse(false, "Not found"), 404);
  const newValue = generateSecret();
  const encrypted = await encrypt(newValue, key);
  await db
    .update(ServiceConfig)
    .set({ value: encrypted })
    .where(and(eq(ServiceConfig.service, service), eq(ServiceConfig.key, k)))
    .execute();
  ConfigService.invalidateCache();
  return c.json(ApiResponse(true, "Rotated", { value: newValue }));
});

// --- Logs ---

admin.get("/logs", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const rows = await db
    .select()
    .from(SendLog)
    .orderBy(desc(SendLog.createdAt))
    .limit(100)
    .all();
  return c.json(ApiResponse(true, null, rows));
});

export default admin;
