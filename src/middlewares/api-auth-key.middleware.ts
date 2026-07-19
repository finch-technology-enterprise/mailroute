// src/middlewares/api-auth-key.middleware.ts
import { Context, Next } from "hono";
import { CloudflareBindings } from "../lib/cloudflare.binding";
import { ApiResponse } from "../utils/response.util";
import { ConfigService } from "../services/config.service";

/**
 * Constant-time, length-independent string comparison.
 * Hashes both inputs with SHA-256 first so the loop always runs over
 * fixed-length digests, leaking neither length nor content via timing.
 */
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b)),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) {
    diff |= va[i] ^ vb[i];
  }
  return diff === 0;
}

export const ApiAuthKeyMiddleware = async (
  c: Context<{ Bindings: CloudflareBindings }>,
  next: Next,
) => {
  const providedKey = c.req.header("X-API-AUTH-KEY");

  if (!providedKey) {
    return c.json(
      ApiResponse(false, "Unauthorized: Missing Authorization header"),
      401,
    );
  }

  const apiKey = await new ConfigService(c.env).get("API_AUTH_KEY");
  if (!(await timingSafeEqual(providedKey, apiKey))) {
    return c.json(
      ApiResponse(false, "Unauthorized: Invalid Authorization header"),
      401,
    );
  }

  await next();
};
