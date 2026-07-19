// src/middlewares/rate-limit.middleware.ts
import { Context, Next } from "hono";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";

/**
 * Throttles requests using the Cloudflare Rate Limiting binding
 * (`RATE_LIMITER`, configured in wrangler.jsonc). The key combines the
 * caller IP with the route path so each endpoint is limited independently.
 */
export const RateLimitMiddleware = async (
  c: Context<{ Bindings: CloudflareBindings }>,
  next: Next,
) => {
  const ip = c.req.header("cf-connecting-ip") || "unknown";
  const key = `${ip}:${new URL(c.req.url).pathname}`;

  const { success } = await c.env.RATE_LIMITER.limit({ key });
  if (!success) {
    return c.json(
      ApiResponse(false, "Too many requests. Please try again later."),
      429,
    );
  }

  await next();
};
