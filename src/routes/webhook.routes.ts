import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { SendLog, EmailVendor } from "../db/schema";
import { EmailService } from "../services/email.service";

async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++)
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return result === 0;
}

const webhook = new Hono<{ Bindings: CloudflareBindings }>();

const statusUpdateSchema = z.object({
  messageId: z.string().min(1),
  status: z.enum(["sent", "delivered", "bounced", "complained", "failed"]),
  error: z.string().optional(),
  timestamp: z.string().optional(),
});

const WEBHOOK_DB_RETRIES = 3;
const WEBHOOK_RETRY_DELAY_MS = 200;

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= WEBHOOK_DB_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, WEBHOOK_RETRY_DELAY_MS * attempt));
    }
  }
}

webhook.post("/:vendor", async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header("X-Webhook-Signature");
  if (
    !signature ||
    !(await verifyWebhookSignature(
      rawBody,
      signature,
      c.env.WEBHOOK_SECRET || "",
    ))
  ) {
    return c.json(ApiResponse(false, "Invalid webhook signature"), 401);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return c.json(ApiResponse(false, "Invalid JSON body"), 400);
  }

  const parsed = statusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(ApiResponse(false, parsed.error.message), 400);
  }

  const vendor = c.req.param("vendor");
  const { messageId, status, error } = parsed.data;

  const db = drizzle(c.env.D1_DATABASE);

  const log = await withRetry(() =>
    db
      .select()
      .from(SendLog)
      .where(
        and(
          eq(SendLog.providerMessageId, messageId),
          eq(SendLog.vendorName, vendor),
        ),
      )
      .get(),
  );

  if (!log) {
    return c.json(ApiResponse(false, "Unknown message"), 404);
  }

  await withRetry(async () => {
    if (
      status === "bounced" ||
      status === "complained" ||
      status === "failed"
    ) {
      await db
        .update(SendLog)
        .set({
          status: "failed",
          error: error || `${vendor} reported: ${status}`,
        })
        .where(eq(SendLog.id, log.id))
        .execute();
    } else if (status === "delivered") {
      await db
        .update(SendLog)
        .set({ status: "delivered" })
        .where(eq(SendLog.id, log.id))
        .execute();
    }
  });

  if (status === "bounced" || status === "failed") {
    c.executionCtx.waitUntil(
      (async () => {
        try {
          const db2 = drizzle(c.env.D1_DATABASE);
          const tenantVendors = await db2
            .select()
            .from(EmailVendor)
            .where(
              and(
                eq(EmailVendor.tenantId, log.tenantId),
                eq(EmailVendor.enabled, true),
              ),
            )
            .orderBy(asc(EmailVendor.priority))
            .all();
          const failedVendor = tenantVendors.find((v) => v.id === log.vendorId);
          const nextVendor = failedVendor
            ? tenantVendors.filter((v) => v.priority > failedVendor.priority)[0]
            : tenantVendors[0];
          if (nextVendor) {
            const emailService = new EmailService(c.env, log.tenantId);
            await emailService.sendEmail(
              c,
              {
                to: log.toEmail,
                subject: log.subject,
                content: "Retry: " + (log.error || ""),
              },
              nextVendor.name,
            );
          }
        } catch (err) {
          console.error("Webhook retry failed:", err);
        }
      })(),
    );
  }

  return c.json(ApiResponse(true, "Status updated"));
});

export default webhook;
