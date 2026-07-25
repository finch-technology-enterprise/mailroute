import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// --- Multi-tenant tables ---

export const Tenant = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  apiAuthKeyHash: text("api_auth_key_hash"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const User = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => Tenant.id),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("admin"),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  verificationToken: text("verification_token"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const Session = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => User.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});

export const ApiKey = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => Tenant.id),
  name: text("name").notNull().default(""),
  keyHash: text("key_hash").notNull(),
  keyPrefix: text("key_prefix").notNull(),
  lastUsedAt: text("last_used_at"),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  revokedAt: text("revoked_at"),
});

// --- Existing tables with added tenant_id ---

export const EmailTemplate = sqliteTable("email_templates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  slug: text("slug").notNull().unique(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const EmailVendor = sqliteTable("email_vendors", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  name: text("name").notNull().unique(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  priority: integer("priority").notNull(),
  apiEndpoint: text("api_endpoint").notNull(),
  apiToken: text("api_token").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name").notNull(),
  config: text("config"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export type EmailVendorRow = typeof EmailVendor.$inferSelect;

export const SendLog = sqliteTable("send_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  vendorId: text("vendor_id").notNull(),
  vendorName: text("vendor_name").notNull(),
  toEmail: text("to_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(),
  error: text("error"),
  templateSlug: text("template_slug"),
  durationMs: integer("duration_ms"),
  createdAt: text("created_at").notNull(),
});

export type SendLogRow = typeof SendLog.$inferSelect;

export const ActivityLog = sqliteTable("activity_logs", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  type: text("type").notNull(),
  summary: text("summary").notNull(),
  detail: text("detail"),
  createdAt: text("created_at").notNull(),
});

export type ActivityLogRow = typeof ActivityLog.$inferSelect;

export const LoginAttempt = sqliteTable("login_attempts", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  ip: text("ip").notNull().default(""),
  attemptedAt: text("attempted_at").notNull(),
});

export const ScheduledEmail = sqliteTable("scheduled_emails", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  payload: text("payload").notNull(),
  sendAt: text("send_at").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const TrackingEvent = sqliteTable("tracking_events", {
  id: text("id").primaryKey(),
  sendId: text("send_id").notNull(),
  type: text("type").notNull(),
  url: text("url"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: text("created_at").notNull(),
});

export const PushSubscription = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  userAgent: text("user_agent"),
  createdAt: text("created_at").notNull(),
});
