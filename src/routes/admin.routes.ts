import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc, desc, count, gt } from "drizzle-orm";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { requireAuth, requireRole } from "./auth.routes";
import { RateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import {
  EmailVendor,
  EmailTemplate,
  SendLog,
  ActivityLog,
  PushSubscription,
  ApiKey,
  User,
} from "../db/schema";
import { EmailService } from "../services/email.service";
import { EmailVendorService } from "../services/email-vendor.service";
import { EmailTemplateService } from "../services/email-template.service";
import { generateApiKey, hashApiKey, hashPassword } from "../lib/password";
import type { AppEnv } from "../lib/app-env";

const admin = new Hono<AppEnv>();

async function logActivity(
  c: CloudflareBindings,
  type: string,
  summary: string,
  detail?: string,
  tenantId?: string,
) {
  try {
    await drizzle(c.D1_DATABASE)
      .insert(ActivityLog)
      .values({
        id: crypto.randomUUID(),
        tenantId: tenantId || "",
        type,
        summary,
        detail: detail || null,
        createdAt: new Date().toISOString(),
      })
      .execute();
  } catch {}
}

admin.use("*", requireAuth);
admin.use("*", RateLimitMiddleware);

// --- Vendor Health ---

admin.get("/vendor-health", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const vendors = await db
    .select()
    .from(EmailVendor)
    .where(eq(EmailVendor.tenantId, tenantId))
    .orderBy(asc(EmailVendor.priority))
    .all();
  const health = await Promise.all(
    vendors.map(async (v) => {
      const [total, failed] = await Promise.all([
        db
          .select({ count: count() })
          .from(SendLog)
          .where(
            and(eq(SendLog.vendorId, v.id), eq(SendLog.tenantId, tenantId)),
          )
          .get(),
        db
          .select({ count: count() })
          .from(SendLog)
          .where(
            and(
              eq(SendLog.vendorId, v.id),
              eq(SendLog.tenantId, tenantId),
              eq(SendLog.status, "failed"),
            ),
          )
          .get(),
      ]);
      return {
        id: v.id,
        name: v.name,
        enabled: v.enabled,
        priority: v.priority,
        totalSends: total?.count ?? 0,
        failedSends: failed?.count ?? 0,
      };
    }),
  );
  return c.json(ApiResponse(true, null, health));
});

// --- Vendors ---

admin.get("/vendors", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "100", 10), 1),
    200,
  );
  const rows = await db
    .select()
    .from(EmailVendor)
    .where(eq(EmailVendor.tenantId, tenantId))
    .orderBy(asc(EmailVendor.priority))
    .limit(limit)
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
  config: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      try {
        JSON.parse(val);
        return true;
      } catch {
        return false;
      }
    }, "Config must be valid JSON"),
});

admin.post(
  "/vendors",
  requireRole("admin"),
  zValidator("json", vendorSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const tenantId = c.get("tenantId");
    const data = c.req.valid("json");
    const id = crypto.randomUUID();
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
    await logActivity(
      c.env,
      "vendor_created",
      `Vendor "${data.name}" created`,
      undefined,
      tenantId,
    );
    return c.json(ApiResponse(true, "Vendor created", row), 201);
  },
);

const vendorUpdateSchema = vendorSchema.partial();

admin.put(
  "/vendors/:id",
  requireRole("admin"),
  zValidator("json", vendorUpdateSchema),
  async (c) => {
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
    await logActivity(
      c.env,
      "vendor_updated",
      `Vendor "${id}" updated`,
      undefined,
      tenantId,
    );
    return c.json(ApiResponse(true, "Vendor updated", row));
  },
);

admin.delete("/vendors/:id", async (c) => {
  if (c.get("userRole") !== "admin")
    return c.json(ApiResponse(false, "Insufficient permissions"), 403);
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(EmailVendor)
    .where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId)))
    .get();
  if (!existing) return c.json(ApiResponse(false, "Vendor not found"), 404);
  await db
    .delete(EmailVendor)
    .where(and(eq(EmailVendor.id, id), eq(EmailVendor.tenantId, tenantId)))
    .execute();
  EmailVendorService.invalidateCache(tenantId);
  await logActivity(
    c.env,
    "vendor_deleted",
    `Vendor "${id}" deleted`,
    undefined,
    tenantId,
  );
  return c.json(ApiResponse(true, "Vendor deleted"));
});

// --- Templates ---

admin.get("/templates", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "100", 10), 1),
    200,
  );
  const rows = await db
    .select()
    .from(EmailTemplate)
    .where(eq(EmailTemplate.tenantId, tenantId))
    .limit(limit)
    .all();
  return c.json(ApiResponse(true, null, rows));
});

const previewSchema = z.object({
  replacements: z.record(z.string(), z.coerce.string()).default({}),
});

admin.post(
  "/templates/:id/preview",
  zValidator("json", previewSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const { replacements } = c.req.valid("json");

    const template = await db
      .select()
      .from(EmailTemplate)
      .where(
        and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)),
      )
      .get();

    if (!template) return c.json(ApiResponse(false, "Template not found"), 404);

    let subject = template.subject;
    let content = template.content;
    Object.entries(replacements).forEach(([key, value]) => {
      const token = `{{${key}}}`;
      subject = subject.split(token).join(value);
      content = content.split(token).join(value);
    });

    return c.json(ApiResponse(true, null, { subject, content }));
  },
);

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
  const id = crypto.randomUUID();
  await db
    .insert(EmailTemplate)
    .values({ id, tenantId, ...data, version: 1 })
    .execute();
  EmailTemplateService.invalidateCache(tenantId);
  const row = await db
    .select()
    .from(EmailTemplate)
    .where(
      and(
        eq(EmailTemplate.slug, data.slug),
        eq(EmailTemplate.tenantId, tenantId),
      ),
    )
    .get();
  await logActivity(
    c.env,
    "template_created",
    `Template "${data.slug}" created`,
    undefined,
    tenantId,
  );
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

    const existing = await db
      .select()
      .from(EmailTemplate)
      .where(
        and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)),
      )
      .get();
    if (!existing) return c.json(ApiResponse(false, "Template not found"), 404);

    await db
      .update(EmailTemplate)
      .set({ ...data, version: (existing.version ?? 1) + 1 })
      .where(
        and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)),
      )
      .execute();
    EmailTemplateService.invalidateCache(tenantId);
    const row = await db
      .select()
      .from(EmailTemplate)
      .where(
        and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)),
      )
      .get();
    if (!row) return c.json(ApiResponse(false, "Template not found"), 404);
    await logActivity(
      c.env,
      "template_updated",
      `Template "${id}" updated to v${row.version}`,
      undefined,
      tenantId,
    );
    return c.json(ApiResponse(true, "Template updated", row));
  },
);

admin.delete("/templates/:id", async (c) => {
  if (c.get("userRole") !== "admin")
    return c.json(ApiResponse(false, "Insufficient permissions"), 403);
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const existing = await db
    .select()
    .from(EmailTemplate)
    .where(and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)))
    .get();
  if (!existing) return c.json(ApiResponse(false, "Template not found"), 404);
  await db
    .delete(EmailTemplate)
    .where(and(eq(EmailTemplate.id, id), eq(EmailTemplate.tenantId, tenantId)))
    .execute();
  EmailTemplateService.invalidateCache(tenantId);
  await logActivity(
    c.env,
    "template_deleted",
    `Template "${id}" deleted`,
    undefined,
    tenantId,
  );
  return c.json(ApiResponse(true, "Template deleted"));
});

// --- Stats ---

admin.get("/stats", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const [vendors, templates, sendCount] = await Promise.all([
    db
      .select()
      .from(EmailVendor)
      .where(eq(EmailVendor.tenantId, tenantId))
      .all(),
    db
      .select()
      .from(EmailTemplate)
      .where(eq(EmailTemplate.tenantId, tenantId))
      .all(),
    db
      .select({ total: count() })
      .from(SendLog)
      .where(eq(SendLog.tenantId, tenantId))
      .get(),
  ]);
  const recentFailed = await db
    .select({ total: count() })
    .from(SendLog)
    .where(
      and(
        eq(SendLog.tenantId, tenantId),
        eq(SendLog.status, "failed"),
        gt(SendLog.createdAt, new Date(Date.now() - 86400000).toISOString()),
      ),
    )
    .get();
  return c.json(
    ApiResponse(true, null, {
      vendorCount: vendors.length,
      templateCount: templates.length,
      totalSends: sendCount?.total ?? 0,
      failedLast24h: recentFailed?.total ?? 0,
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

admin.post(
  "/test-send",
  requireRole("admin"),
  zValidator("json", testSendSchema),
  async (c) => {
    const { to, subject, content, vendor } = c.req.valid("json");
    const emailService = new EmailService(c.env, c.get("tenantId"));
    try {
      await emailService.sendEmail(c, { to, subject, content }, vendor);
      return c.json(ApiResponse(true, "Email sent"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json(ApiResponse(false, message), 502);
    }
  },
);

// --- Logs ---

admin.get("/logs", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "50", 10), 1),
    200,
  );
  const [sends, activities] = await Promise.all([
    db
      .select({
        id: SendLog.id,
        type: SendLog.status,
        summary: SendLog.subject,
        detail: SendLog.vendorName,
        toEmail: SendLog.toEmail,
        createdAt: SendLog.createdAt,
      })
      .from(SendLog)
      .where(eq(SendLog.tenantId, tenantId))
      .orderBy(desc(SendLog.createdAt))
      .limit(limit)
      .all(),
    db
      .select({
        id: ActivityLog.id,
        type: ActivityLog.type,
        summary: ActivityLog.summary,
        detail: ActivityLog.detail,
        createdAt: ActivityLog.createdAt,
      })
      .from(ActivityLog)
      .where(eq(ActivityLog.tenantId, tenantId))
      .orderBy(desc(ActivityLog.createdAt))
      .limit(limit)
      .all(),
  ]);
  const mapped: Array<{
    id: string;
    type: string;
    summary: string;
    detail: string;
    status: string | null;
    createdAt: string;
  }> = [];
  let si = 0;
  let ai = 0;
  while (
    mapped.length < limit &&
    (si < sends.length || ai < activities.length)
  ) {
    const s = si < sends.length ? sends[si] : null;
    const a = ai < activities.length ? activities[ai] : null;
    if (s && (!a || s.createdAt >= a.createdAt)) {
      mapped.push({
        id: s.id,
        type: s.type === "sent" ? "email_sent" : "email_failed",
        summary: s.summary,
        detail: `${s.detail} → ${s.toEmail}`,
        status: s.type,
        createdAt: s.createdAt,
      });
      si++;
    } else if (a) {
      mapped.push({
        id: a.id,
        type: a.type,
        summary: a.summary,
        detail: a.detail || "",
        status: null,
        createdAt: a.createdAt,
      });
      ai++;
    }
  }
  return c.json(ApiResponse(true, null, mapped));
});

// --- Log Export ---

admin.get("/logs/export", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const format = c.req.query("format") || "csv";
  const rows = await db
    .select()
    .from(SendLog)
    .where(eq(SendLog.tenantId, tenantId))
    .orderBy(desc(SendLog.createdAt))
    .all();

  if (format === "json") {
    return new Response(JSON.stringify(rows), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="send-logs.json"',
      },
    });
  }

  const cols: Array<keyof typeof SendLog._.columns> = [
    "id",
    "tenantId",
    "vendorId",
    "vendorName",
    "toEmail",
    "subject",
    "status",
    "error",
    "durationMs",
    "createdAt",
  ];
  const escape = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv = [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => escape((r as any)[c])).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="send-logs.csv"',
    },
  });
});

// --- API Keys ---

const createApiKeySchema = z.object({
  name: z.string().min(1).max(128),
});

admin.get("/api-keys", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") || "100", 10), 1),
    200,
  );
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
    .limit(limit)
    .all();
  return c.json(ApiResponse(true, null, keys));
});

admin.post(
  "/api-keys",
  requireRole("admin"),
  zValidator("json", createApiKeySchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const tenantId = c.get("tenantId");
    const { name } = c.req.valid("json");

    const rawKey = generateApiKey();
    const keyHash = await hashApiKey(rawKey, c.env.CONFIG_ENCRYPTION_KEY);
    const keyPrefix = rawKey.slice(0, 10) + "...";

    await db
      .insert(ApiKey)
      .values({
        id: crypto.randomUUID(),
        tenantId,
        name,
        keyHash,
        keyPrefix,
      })
      .execute();

    await logActivity(
      c.env,
      "api_key_created",
      `API key "${name}" created`,
      undefined,
      tenantId,
    );

    return c.json(
      ApiResponse(true, "API key created", { rawKey, name, keyPrefix }),
      201,
    );
  },
);

admin.delete("/api-keys/:id", async (c) => {
  if (c.get("userRole") !== "admin")
    return c.json(ApiResponse(false, "Insufficient permissions"), 403);
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(ApiKey)
    .where(and(eq(ApiKey.id, id), eq(ApiKey.tenantId, tenantId)))
    .get();

  if (!existing) return c.json(ApiResponse(false, "API key not found"), 404);
  if (existing.revokedAt)
    return c.json(ApiResponse(false, "API key already revoked"));

  await db
    .update(ApiKey)
    .set({ revokedAt: new Date().toISOString() })
    .where(eq(ApiKey.id, id))
    .execute();

  await logActivity(
    c.env,
    "api_key_revoked",
    `API key "${existing.name}" revoked`,
    undefined,
    tenantId,
  );

  return c.json(ApiResponse(true, "API key revoked"));
});

// --- Users ---

const createUserSchema = z.object({
  name: z.string().min(1).max(128),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "operator"]).default("operator"),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  role: z.enum(["admin", "operator"]).optional(),
});

admin.get("/users", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const rows = await db
    .select({
      id: User.id,
      email: User.email,
      name: User.name,
      role: User.role,
      emailVerified: User.emailVerified,
      createdAt: User.createdAt,
    })
    .from(User)
    .where(eq(User.tenantId, tenantId))
    .all();
  return c.json(ApiResponse(true, null, rows));
});

admin.post(
  "/users",
  requireRole("admin"),
  zValidator("json", createUserSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const tenantId = c.get("tenantId");
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(User)
      .where(eq(User.email, data.email))
      .get();
    if (existing)
      return c.json(ApiResponse(false, "Email already in use"), 409);

    const passwordHash = await hashPassword(data.password);
    const id = crypto.randomUUID();

    await db
      .insert(User)
      .values({
        id,
        tenantId,
        email: data.email,
        passwordHash,
        name: data.name,
        role: data.role,
      })
      .execute();

    const row = await db
      .select({
        id: User.id,
        email: User.email,
        name: User.name,
        role: User.role,
        emailVerified: User.emailVerified,
        createdAt: User.createdAt,
      })
      .from(User)
      .where(eq(User.id, id))
      .get();

    await logActivity(
      c.env,
      "user_created",
      `User "${data.email}" created`,
      undefined,
      tenantId,
    );
    return c.json(ApiResponse(true, "User created", row), 201);
  },
);

admin.put(
  "/users/:id",
  requireRole("admin"),
  zValidator("json", updateUserSchema),
  async (c) => {
    const db = drizzle(c.env.D1_DATABASE);
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(User)
      .where(and(eq(User.id, id), eq(User.tenantId, tenantId)))
      .get();
    if (!existing) return c.json(ApiResponse(false, "User not found"), 404);

    await db.update(User).set(data).where(eq(User.id, id)).execute();

    const row = await db
      .select({
        id: User.id,
        email: User.email,
        name: User.name,
        role: User.role,
        emailVerified: User.emailVerified,
        createdAt: User.createdAt,
      })
      .from(User)
      .where(eq(User.id, id))
      .get();

    await logActivity(
      c.env,
      "user_updated",
      `User "${existing.email}" updated`,
      undefined,
      tenantId,
    );
    return c.json(ApiResponse(true, "User updated", row));
  },
);

admin.delete("/users/:id", async (c) => {
  if (c.get("userRole") !== "admin")
    return c.json(ApiResponse(false, "Insufficient permissions"), 403);
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(User)
    .where(and(eq(User.id, id), eq(User.tenantId, tenantId)))
    .get();
  if (!existing) return c.json(ApiResponse(false, "User not found"), 404);

  const currentUserId = c.get("userId");
  if (id === currentUserId)
    return c.json(ApiResponse(false, "Cannot delete yourself"), 400);

  await db.delete(User).where(eq(User.id, id)).execute();
  await logActivity(
    c.env,
    "user_deleted",
    `User "${existing.email}" deleted`,
    undefined,
    tenantId,
  );
  return c.json(ApiResponse(true, "User deleted"));
});

// --- Push Subscriptions ---

admin.post("/push/subscribe", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const body = await c.req.json();
  const { endpoint, keys } = body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return c.json(ApiResponse(false, "Invalid subscription"), 400);
  }
  const existing = await db
    .select()
    .from(PushSubscription)
    .where(
      and(
        eq(PushSubscription.endpoint, endpoint),
        eq(PushSubscription.tenantId, tenantId),
      ),
    )
    .get();
  if (existing) return c.json(ApiResponse(true, "Already subscribed"));
  await db
    .insert(PushSubscription)
    .values({
      id: crypto.randomUUID(),
      tenantId,
      endpoint,
      p256dhKey: keys.p256dh,
      authKey: keys.auth,
      userAgent: c.req.header("user-agent") || null,
      createdAt: new Date().toISOString(),
    })
    .execute();
  return c.json(ApiResponse(true, "Subscribed"));
});

admin.delete("/push/subscribe", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const { endpoint } = (await c.req.json()) as { endpoint: string };
  if (!endpoint) return c.json(ApiResponse(false, "Missing endpoint"), 400);
  await db
    .delete(PushSubscription)
    .where(
      and(
        eq(PushSubscription.endpoint, endpoint),
        eq(PushSubscription.tenantId, tenantId),
      ),
    )
    .execute();
  return c.json(ApiResponse(true, "Unsubscribed"));
});

export default admin;
