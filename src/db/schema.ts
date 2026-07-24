import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// src/db/schema.ts
export const EmailTemplate = sqliteTable("email_templates", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

/**
 * Central, multi-service configuration store. Shared across microservices
 * that bind the same D1 database. `service = "*"` holds values shared by all
 * services; a row with a specific service name overrides the shared value.
 */
export const ServiceConfig = sqliteTable(
  "service_config",
  {
    service: text("service").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
  },
  (table) => [primaryKey({ columns: [table.service, table.key] })],
);

/**
 * Email vendor registry. One row per vendor; `name` maps to a registered
 * adapter in src/vendors. Enabled vendors are tried in ascending `priority`
 * order (failover chain). Editable live in D1 — no redeploy needed to switch
 * vendors, rotate tokens, or change the sender identity.
 */
export const EmailVendor = sqliteTable("email_vendors", {
  id: text("id").primaryKey(),
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
