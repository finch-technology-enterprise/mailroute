import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { SendLog } from "../db/schema";

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  if (!secret || !signature) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));
  if (expected.length !== signature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
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

webhook.post("/:vendor", zValidator("json", statusUpdateSchema), async (c) => {
  const rawBody = await c.req.raw.clone().text();
  const signature = c.req.header("X-Webhook-Signature");
  if (!signature || !(await verifyWebhookSignature(rawBody, signature, c.env.WEBHOOK_SECRET || ""))) {
    return c.json(ApiResponse(false, "Invalid webhook signature"), 401);
  }

  const vendor = c.req.param("vendor");
  const { messageId, status, error } = c.req.valid("json");

  const db = drizzle(c.env.D1_DATABASE);

  const log = await withRetry(() =>
    db.select().from(SendLog).where(eq(SendLog.id, messageId)).get(),
  );

  if (!log) {
    return c.json(ApiResponse(false, "Unknown message"), 404);
  }

  await withRetry(async () => {
    if (status === "bounced" || status === "complained" || status === "failed") {
      await db
        .update(SendLog)
        .set({ status: "failed", error: error || `${vendor} reported: ${status}` })
        .where(eq(SendLog.id, messageId))
        .execute();
    } else if (status === "delivered") {
      await db
        .update(SendLog)
        .set({ status: "delivered" })
        .where(eq(SendLog.id, messageId))
        .execute();
    }
  });

  return c.json(ApiResponse(true, "Status updated"));
});

export default webhook;
