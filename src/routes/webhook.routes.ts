import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { SendLog } from "../db/schema";

const webhook = new Hono<{ Bindings: CloudflareBindings }>();

const statusUpdateSchema = z.object({
  messageId: z.string().min(1),
  status: z.enum(["sent", "delivered", "bounced", "complained", "failed"]),
  error: z.string().optional(),
  timestamp: z.string().optional(),
});

webhook.post("/:vendor", zValidator("json", statusUpdateSchema), async (c) => {
  const vendor = c.req.param("vendor");
  const { messageId, status, error } = c.req.valid("json");

  const db = drizzle(c.env.D1_DATABASE);
  const log = await db.select().from(SendLog).where(eq(SendLog.id, messageId)).get();

  if (!log) {
    return c.json(ApiResponse(false, "Unknown message"), 404);
  }

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

  return c.json(ApiResponse(true, "Status updated"));
});

export default webhook;
