import { Context } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, gt } from "drizzle-orm";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { LogToNewRelic } from "../utils/helpers.util";
import { EmailVendorService } from "./email-vendor.service";
import { SendLog } from "../db/schema";
import { ADAPTERS } from "../vendors";
import { sendPushNotification } from "./push.service";

const VENDOR_TIMEOUT_MS = 10_000;
const CIRCUIT_BREAKER_THRESHOLD = 5;
const CIRCUIT_BREAKER_WINDOW_MS = 300_000;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1_000;

function redactError(msg: string): string {
  return msg.replace(/(token|key|secret|auth|password|api[_-]?key)[=:]\s*\S+/gi, "$1=[REDACTED]");
}

export interface EmailPayload {
  to: string;
  subject: string;
  content: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error(`Vendor timeout after ${ms}ms`));
      });
    }),
  ]).finally(() => clearTimeout(timeout));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class EmailService {
  private readonly vendorService: EmailVendorService;
  private readonly env: CloudflareBindings;
  private readonly tenantId: string;

  constructor(env: CloudflareBindings, tenantId: string) {
    this.env = env;
    this.vendorService = new EmailVendorService(env, tenantId);
    this.tenantId = tenantId;
  }

  private async getVendorsInCooldown(vendorIds: string[]): Promise<Set<string>> {
    const cutoff = new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_MS).toISOString();
    const db = drizzle(this.env.D1_DATABASE);
    const failed = await db
      .select({ vendorId: SendLog.vendorId })
      .from(SendLog)
      .where(
        and(
          eq(SendLog.status, "failed"),
          gt(SendLog.createdAt, cutoff),
          eq(SendLog.tenantId, this.tenantId),
        ),
      )
      .all();
    const counts = new Map<string, number>();
    for (const row of failed) {
      counts.set(row.vendorId, (counts.get(row.vendorId) || 0) + 1);
    }
    return new Set(vendorIds.filter((id) => (counts.get(id) || 0) >= CIRCUIT_BREAKER_THRESHOLD));
  }

  private async recordSendLog(
    c: Context<any, any, any>,
    vendor: { id: string; name: string },
    payload: EmailPayload,
    status: "sent" | "failed",
    durationMs: number,
    error?: string,
  ) {
    const db = drizzle(c.env.D1_DATABASE);
    c.executionCtx.waitUntil(
      db.insert(SendLog).values({
        id: crypto.randomUUID(),
        tenantId: this.tenantId,
        vendorId: vendor.id,
        vendorName: vendor.name,
        toEmail: payload.to,
        subject: payload.subject,
        status,
        error: error ? redactError(error) : null,
        durationMs,
        createdAt: new Date().toISOString(),
      }).execute().catch(() => {}),
    );
    const pushPayload = status === "sent"
      ? { title: "Email sent", body: `"${payload.subject}" → ${payload.to} via ${vendor.name}`, tag: "email-sent" }
      : { title: "Email failed", body: `${vendor.name}: ${(error || "").slice(0, 200)}`, tag: "email-failed" };
    c.executionCtx.waitUntil(
      sendPushNotification(c.env, pushPayload).catch((e) => { console.error("Push notification failed:", e); }),
    );
  }

  async sendEmail(
    c: Context<any, any, any>,
    payload: EmailPayload,
    vendorName?: string,
  ) {
    LogToNewRelic(c, "sendEmail", payload);

    let vendors = await this.vendorService.getActiveVendors();
    if (vendorName) {
      vendors = vendors.filter((v) => v.name === vendorName);
    }
    if (vendors.length === 0) {
      throw new Error("No email vendors configured");
    }

    const inCooldownIds = await this.getVendorsInCooldown(vendors.map((v) => v.id));
    const errors: string[] = [];
    for (const vendor of vendors) {
      const adapter = ADAPTERS[vendor.name];
      if (!adapter) {
        errors.push(`unknown adapter: ${vendor.name}`);
        continue;
      }

      const inCooldown = inCooldownIds.has(vendor.id);
      if (inCooldown) {
        errors.push(`${vendor.name}: skipped (circuit breaker)`);
        LogToNewRelic(c, "sendEmail:circuit-breaker", {
          level: "WARN",
          vendor: vendor.name,
        });
        continue;
      }

      const attemptSend = async (): Promise<void> => {
        await withTimeout(
          adapter.send({
            endpoint: vendor.apiEndpoint,
            token: vendor.apiToken,
            from: { email: vendor.fromEmail, name: vendor.fromName },
            to: payload.to,
            subject: payload.subject,
            html: payload.content,
            cc: payload.cc,
            bcc: payload.bcc,
            attachments: payload.attachments,
            config: parseConfig(vendor.config),
          }),
          VENDOR_TIMEOUT_MS,
        );
      };

      const startTime = Date.now();

      try {
        await attemptSend();
        const durationMs = Date.now() - startTime;
        LogToNewRelic(c, "sendEmail:success", {
          vendor: vendor.name,
          "context.to": payload.to,
        });
        await this.recordSendLog(c, vendor, payload, "sent", durationMs);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const durationMs = Date.now() - startTime;
        errors.push(`${vendor.name}: ${message}`);

        LogToNewRelic(c, "sendEmail:failover", {
          level: "WARN",
          vendor: vendor.name,
          "context.error": message,
        });

        await this.recordSendLog(c, vendor, payload, "failed", durationMs, message);

        if (isTransientError(error)) {
          let retrySuccess = false;
          for (let retry = 1; retry <= MAX_RETRIES; retry++) {
            const delay = RETRY_BASE_DELAY_MS * Math.pow(2, retry - 1);
            try {
              await sleep(delay);
              await attemptSend();
              const retryDurationMs = Date.now() - startTime - delay;
              LogToNewRelic(c, "sendEmail:retry-success", {
                vendor: vendor.name,
                "context.to": payload.to,
                "context.retry": retry,
              });
              await this.recordSendLog(c, vendor, payload, "sent", retryDurationMs);
              retrySuccess = true;
              break;
            } catch (retryError) {
              const retryMessage =
                retryError instanceof Error
                  ? retryError.message
                  : String(retryError);
              errors.push(`${vendor.name}: retry ${retry}/${MAX_RETRIES} failed (${retryMessage})`);
              LogToNewRelic(c, "sendEmail:retry-failed", {
                level: "WARN",
                vendor: vendor.name,
                "context.error": retryMessage,
                "context.retry": retry,
              });
            }
          }
          if (retrySuccess) return;
        }
      }
    }

    throw new Error(`All email vendors failed: ${errors.join("; ")}`);
  }
}

function isTransientError(error: unknown): boolean {
  const msg =
    error instanceof Error ? error.message.toLowerCase() : String(error);
  return (
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    /\b5\d{2}\b/.test(msg) ||  // only match HTTP 5xx status codes
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("unavailable") ||
    msg.includes("service unavailable") ||
    msg.includes("network error") ||
    msg.includes("dns")
  );
}

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
