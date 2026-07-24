// src/services/email.service.ts
import { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { LogToNewRelic } from "../utils/helpers.util";
import { EmailVendorService } from "./email-vendor.service";
import { SendLog } from "../db/schema";
import { ADAPTERS } from "../vendors";

export interface EmailPayload {
  to: string;
  subject: string;
  content: string;
}

export class EmailService {
  private readonly vendorService: EmailVendorService;

  constructor(env: CloudflareBindings) {
    this.vendorService = new EmailVendorService(env);
  }

  /**
   * Sends `payload` through the configured vendor failover chain. Tries each
   * enabled vendor in priority order; on failure, logs and falls back to the
   * next. Throws only when every vendor fails (or none are configured) — the
   * route layer runs this inside waitUntil().catch().
   */
  async sendEmail(
    c: Context<{ Bindings: CloudflareBindings }>,
    payload: EmailPayload,
  ) {
    LogToNewRelic(c, "sendEmail", payload);

    const vendors = await this.vendorService.getActiveVendors();
    if (vendors.length === 0) {
      throw new Error("No email vendors configured");
    }

    const errors: string[] = [];
    for (const vendor of vendors) {
      const adapter = ADAPTERS[vendor.name];
      if (!adapter) {
        errors.push(`unknown adapter: ${vendor.name}`);
        continue;
      }

      try {
        await adapter.send({
          endpoint: vendor.apiEndpoint,
          token: vendor.apiToken,
          from: { email: vendor.fromEmail, name: vendor.fromName },
          to: payload.to,
          subject: payload.subject,
          html: payload.content,
          config: parseConfig(vendor.config),
        });
        LogToNewRelic(c, "sendEmail:success", {
          vendor: vendor.name,
          "context.to": payload.to,
        });
        await drizzle(c.env.D1_DATABASE)
          .insert(SendLog)
          .values({
            id: crypto.randomUUID(),
            vendorId: vendor.id,
            vendorName: vendor.name,
            toEmail: payload.to,
            subject: payload.subject,
            status: "sent",
            error: null,
            templateSlug: null,
            durationMs: null,
            createdAt: new Date().toISOString(),
          })
          .execute();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${vendor.name}: ${message}`);
        LogToNewRelic(c, "sendEmail:failover", {
          level: "WARN",
          vendor: vendor.name,
          "context.error": message,
        });
        await drizzle(c.env.D1_DATABASE)
          .insert(SendLog)
          .values({
            id: crypto.randomUUID(),
            vendorId: vendor.id,
            vendorName: vendor.name,
            toEmail: payload.to,
            subject: payload.subject,
            status: "failed",
            error: message,
            templateSlug: null,
            durationMs: null,
            createdAt: new Date().toISOString(),
          })
          .execute();
      }
    }

    throw new Error(`All email vendors failed: ${errors.join("; ")}`);
  }
}

/** Parses a vendor row's JSON `config` column; returns {} on null/invalid. */
function parseConfig(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
