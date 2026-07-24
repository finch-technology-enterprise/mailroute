import { Context, Hono, Next } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { Tenant, User } from "../db/schema";
import { signJWT, verifyJWT } from "../lib/jwt";
import { hashPassword, verifyPassword, generateApiKey, hashApiKey } from "../lib/password";
import { ApiResponse } from "../utils/response.util";
import type { AppEnv } from "../lib/app-env";

const auth = new Hono<AppEnv>();

const signupSchema = z.object({
  name: z.string().min(1).max(128),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  tenantName: z.string().min(1).max(128),
  tenantSlug: z.string().min(3).max(64).regex(/^[a-z0-9-]+$/),
});

auth.post("/signup", zValidator("json", signupSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const { name, email, password, tenantName, tenantSlug } = c.req.valid("json");

  const existingUser = await db.select().from(User).where(eq(User.email, email)).get();
  if (existingUser) {
    return c.json(ApiResponse(false, "Email already registered"), 409);
  }

  const existingTenant = await db.select().from(Tenant).where(eq(Tenant.slug, tenantSlug)).get();
  if (existingTenant) {
    return c.json(ApiResponse(false, "Tenant slug already taken"), 409);
  }

  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await db.insert(Tenant).values({
    id: tenantId, name: tenantName, slug: tenantSlug, apiAuthKeyHash: apiKeyHash,
  }).execute();

  await db.insert(User).values({
    id: userId, tenantId, email, passwordHash, name, role: "admin",
  }).execute();

  const token = await signJWT({ sub: userId, tenantId, role: "admin" }, c.env.JWT_SECRET);

  return c.json(ApiResponse(true, null, {
    user: { id: userId, email, name, role: "admin" },
    tenant: { id: tenantId, name: tenantName, slug: tenantSlug, apiKey },
    token,
  }), 201);
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const { email, password } = c.req.valid("json");

  const user = await db.select().from(User).where(eq(User.email, email)).get();
  if (!user) return c.json(ApiResponse(false, "Invalid email or password"), 401);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return c.json(ApiResponse(false, "Invalid email or password"), 401);

  const tenant = await db.select().from(Tenant).where(eq(Tenant.id, user.tenantId)).get();
  if (!tenant) return c.json(ApiResponse(false, "Tenant not found"), 404);

  const token = await signJWT(
    { sub: user.id, tenantId: user.tenantId, role: user.role },
    c.env.JWT_SECRET,
  );

  return c.json(ApiResponse(true, null, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    token,
  }));
});

auth.get("/me", requireAuth, async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const userId = c.get("userId");
  const tenantId = c.get("tenantId");

  const user = await db.select().from(User).where(eq(User.id, userId)).get();
  const tenant = await db.select().from(Tenant).where(eq(Tenant.id, tenantId)).get();
  if (!user || !tenant) return c.json(ApiResponse(false, "Not found"), 404);

  return c.json(ApiResponse(true, null, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  }));
});

auth.post("/logout", requireAuth, async (c) => {
  return c.json(ApiResponse(true, "Logged out"));
});

export async function requireAuth(
  c: Context<AppEnv>,
  next: Next,
) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json(ApiResponse(false, "Missing Authorization header"), 401);
  }
  const payload = await verifyJWT(header.slice(7), c.env.JWT_SECRET);
  if (!payload) {
    return c.json(ApiResponse(false, "Invalid or expired token"), 401);
  }
  c.set("userId", payload.sub);
  c.set("tenantId", payload.tenantId);
  c.set("userRole", payload.role);
  await next();
}

export default auth;
