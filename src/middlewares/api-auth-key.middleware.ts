import { Context, Next } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull } from "drizzle-orm";
import { ApiResponse } from "../utils/response.util";
import { ApiKey } from "../db/schema";
import { hashApiKey } from "../lib/password";
import type { AppEnv } from "../lib/app-env";

export const ApiAuthKeyMiddleware = async (
  c: Context<AppEnv>,
  next: Next,
) => {
  const providedKey = c.req.header("X-API-AUTH-KEY");

  if (!providedKey) {
    return c.json(
      ApiResponse(false, "Unauthorized: Missing X-API-AUTH-KEY header"),
      401,
    );
  }

  const keyHash = await hashApiKey(providedKey);

  const db = drizzle(c.env.D1_DATABASE);
  const record = await db
    .select({ id: ApiKey.id, tenantId: ApiKey.tenantId })
    .from(ApiKey)
    .where(and(eq(ApiKey.keyHash, keyHash), isNull(ApiKey.revokedAt)))
    .get();

  if (!record) {
    return c.json(ApiResponse(false, "Unauthorized: Invalid API key"), 401);
  }

  c.set("tenantId", record.tenantId);

  c.executionCtx.waitUntil(
    db.update(ApiKey).set({ lastUsedAt: new Date().toISOString() }).where(eq(ApiKey.id, record.id)).execute().catch(() => {}),
  );

  await next();
};
