import { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { ApiResponse } from "../utils/response.util";
import { Tenant } from "../db/schema";
import type { AppEnv } from "../lib/app-env";

export const ApiAuthKeyMiddleware = async (
  c: Context<AppEnv>,
  next: Next,
) => {
  const providedKey = c.req.header("X-API-AUTH-KEY");

  if (!providedKey) {
    return c.json(
      ApiResponse(false, "Unauthorized: Missing Authorization header"),
      401,
    );
  }

  const encoder = new TextEncoder();
  const providedHash = await crypto.subtle.digest("SHA-256", encoder.encode(providedKey));
  const providedB64 = btoa(String.fromCharCode(...new Uint8Array(providedHash)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

  const db = drizzle(c.env.D1_DATABASE);
  const allTenants = await db.select({
    id: Tenant.id,
    apiAuthKeyHash: Tenant.apiAuthKeyHash,
  }).from(Tenant).all();

  const matchedTenant = allTenants.find((t) => t.apiAuthKeyHash === providedB64);
  if (!matchedTenant) {
    return c.json(ApiResponse(false, "Unauthorized: Invalid API key"), 401);
  }

  c.set("tenantId", matchedTenant.id);
  await next();
};
