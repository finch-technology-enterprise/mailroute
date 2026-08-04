import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, asc } from "drizzle-orm";
import { z } from "zod";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { SendLog, EmailVendor, DeliveryEvent } from "../db/schema";
import { EmailService } from "../services/email.service";
import { LogToNewRelic } from "../utils/helpers.util";

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

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("UNIQUE constraint failed");
}

// Length-prefix the free-form parts (vendor, messageId can contain anything,
// including the separator) so two different events can never collide onto
// the same key regardless of content.
function idempotencyKeyFor(
  vendor: string,
  messageId: string,
  status: string,
): string {
  return `${vendor.length}:${vendor}:${messageId.length}:${messageId}:${status}`;
}

/**
 * Records the raw event for audit and dedupes on `idempotencyKey`. Returns
 * true when this exact event was already processed — vendors deliver
 * webhooks at-least-once, so callers must treat that as "skip side effects,
 * respond success" rather than an error.
 */
async function recordDeliveryEvent(
  db: ReturnType<typeof drizzle>,
  values: typeof DeliveryEvent.$inferInsert,
): Promise<boolean> {
  try {
    await db.insert(DeliveryEvent).values(values).execute();
    return false;
  } catch (err) {
    if (isUniqueConstraintError(err)) return true;
    await withRetry(() => db.insert(DeliveryEvent).values(values).execute());
    return false;
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

  const matches = await withRetry(() =>
    db
      .select()
      .from(SendLog)
      .where(
        and(
          eq(SendLog.providerMessageId, messageId),
          eq(SendLog.vendorName, vendor),
        ),
      )
      .all(),
  );

  if (matches.length === 0) {
    return c.json(ApiResponse(false, "Unknown message"), 404);
  }

  if (matches.length > 1) {
    // vendorName is only unique per tenant (migration 0020), so a vendor
    // row named the same in two tenants makes this correlation genuinely
    // ambiguous. Refuse to guess — acting on the wrong tenant's log would
    // be worse than not acting — and surface it for follow-up instead.
    LogToNewRelic(c, "webhook:ambiguous-correlation", {
      level: "ERROR",
      vendor,
      "context.messageId": messageId,
      "context.matchCount": matches.length,
    });
    return c.json(ApiResponse(false, "Ambiguous message correlation"), 409);
  }

  const log = matches[0];

  // Reserve this event's idempotency slot before any side effect. Vendors
  // deliver webhooks at-least-once, so the same event can arrive again.
  const deliveryEventId = crypto.randomUUID();
  const alreadyProcessed = await recordDeliveryEvent(db, {
    id: deliveryEventId,
    vendorName: vendor,
    providerEventId: messageId,
    eventType: status,
    providerMessageId: messageId,
    rawPayload: rawBody,
    idempotencyKey: idempotencyKeyFor(vendor, messageId, status),
    processedAt: new Date().toISOString(),
  });

  if (status === "bounced" || status === "complained" || status === "failed") {
    await withRetry(() =>
      db
        .update(SendLog)
        .set({
          status: "failed",
          error: error || `${vendor} reported: ${status}`,
        })
        .where(eq(SendLog.id, log.id))
        .execute(),
    );
  }
  // "sent"/"delivered" confirmations don't touch SendLog.status: the column
  // only ever holds 'sent'/'failed' (enforced by a DB CHECK constraint) and
  // is already "sent" from the original send — the DeliveryEvent row above
  // is the audit trail for these confirmations.

  if (!alreadyProcessed && (status === "bounced" || status === "failed")) {
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
          const message = err instanceof Error ? err.message : String(err);
          console.error("Webhook retry failed:", err);
          LogToNewRelic(c, "webhook:retry-failed", {
            level: "ERROR",
            vendor,
            "context.messageId": messageId,
            "context.error": message,
          });
          // The retry-send never happened (EmailService already exhausts
          // its own internal retries/failover before throwing), so release
          // this event's idempotency slot instead of consuming it forever —
          // a future redelivery of this exact event should get another shot
          // rather than silently losing the customer's retry email.
          try {
            await drizzle(c.env.D1_DATABASE)
              .delete(DeliveryEvent)
              .where(eq(DeliveryEvent.id, deliveryEventId))
              .execute();
          } catch (cleanupErr) {
            console.error(
              "Failed to release idempotency reservation:",
              cleanupErr,
            );
          }
        }
      })(),
    );
  }

  return c.json(ApiResponse(true, "Status updated"));
});

export default webhook;
