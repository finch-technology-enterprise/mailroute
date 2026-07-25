import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { TrackingEvent } from "../db/schema";
import type { CloudflareBindings } from "../lib/cloudflare.binding";

const tracking = new Hono<{ Bindings: CloudflareBindings }>();

const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

tracking.get("/open/:id", async (c) => {
  const { id } = c.req.param();
  const db = drizzle(c.env.D1_DATABASE);

  c.executionCtx.waitUntil(
    db.insert(TrackingEvent).values({
      id: crypto.randomUUID(),
      sendId: id,
      type: "open",
      url: null,
      userAgent: c.req.header("user-agent") || null,
      ip: c.req.header("cf-connecting-ip") || null,
      createdAt: new Date().toISOString(),
    }).catch(() => {}),
  );

  return c.body(PIXEL, 200, {
    "Content-Type": "image/gif",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
});

tracking.get("/click/:id", async (c) => {
  const { id } = c.req.param();
  const url = c.req.query("url");

  if (!url) {
    return c.json({ success: false, message: "Missing url parameter" }, 400);
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(url);
  } catch {
    return c.json({ success: false, message: "Invalid url" }, 400);
  }

  const db = drizzle(c.env.D1_DATABASE);

  c.executionCtx.waitUntil(
    db.insert(TrackingEvent).values({
      id: crypto.randomUUID(),
      sendId: id,
      type: "click",
      url: targetUrl.toString(),
      userAgent: c.req.header("user-agent") || null,
      ip: c.req.header("cf-connecting-ip") || null,
      createdAt: new Date().toISOString(),
    }).catch(() => {}),
  );

  return c.redirect(targetUrl.toString(), 302);
});

export default tracking;
