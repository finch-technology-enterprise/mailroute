import { Context, Hono, Next } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gt, count as drizzleCount } from "drizzle-orm";
import { Tenant, User, ApiKey, LoginAttempt } from "../db/schema";
import { signJWT, verifyJWT } from "../lib/jwt";
import { generateResetToken, verifyResetToken } from "../lib/reset-token";
import { hashPassword, verifyPassword, generateApiKey, hashApiKey } from "../lib/password";
import { ApiResponse } from "../utils/response.util";
import { RateLimitMiddleware } from "../middlewares/rate-limit.middleware";
import { EmailService } from "../services/email.service";
import type { AppEnv } from "../lib/app-env";

const JWT_EXPIRY_SEC = 86400;
const REFRESH_EXPIRY_SEC = 604800;

function isLocalDev(c: Context<AppEnv>): boolean {
  const url = new URL(c.req.url);
  return url.hostname === "localhost" || url.hostname === "127.0.0.1";
}

function setAuthCookies(c: Context<AppEnv>, token: string, refreshToken: string): void {
  const opts = {
    httpOnly: true,
    secure: !isLocalDev(c),
    sameSite: "Strict" as const,
    path: "/api",
  };
  setCookie(c, "auth_token", token, { ...opts, maxAge: JWT_EXPIRY_SEC });
  setCookie(c, "refresh_token", refreshToken, { ...opts, maxAge: REFRESH_EXPIRY_SEC });
}

function clearAuthCookies(c: Context<AppEnv>): void {
  setCookie(c, "auth_token", "", { httpOnly: true, path: "/api", maxAge: 0 });
  setCookie(c, "refresh_token", "", { httpOnly: true, path: "/api", maxAge: 0 });
}

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
  const hmacSecret = c.env.CONFIG_ENCRYPTION_KEY;
  const apiKeyHash = await hashApiKey(apiKey, hmacSecret);
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  await db.insert(Tenant).values({
    id: tenantId, name: tenantName, slug: tenantSlug,
  }).execute();

  const verifyToken = crypto.randomUUID();

  await db.insert(User).values({
    id: userId, tenantId, email, passwordHash, name, role: "admin", verificationToken: verifyToken,
  }).execute();

  await db.insert(ApiKey).values({
    id: crypto.randomUUID(),
    tenantId,
    name: "Default",
    keyHash: apiKeyHash,
    keyPrefix: apiKey.slice(0, 10) + "...",
  }).execute();

  const token = await signJWT({ sub: userId, tenantId, role: "admin" }, c.env.JWT_SECRET, JWT_EXPIRY_SEC);
  const refreshToken = await signJWT({ sub: userId, tenantId, role: "admin" }, c.env.JWT_SECRET, REFRESH_EXPIRY_SEC);
  setAuthCookies(c, token, refreshToken);

  const verifyUrl = `${new URL(c.req.url).origin}/api/auth/verify-email?token=${verifyToken}`;
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const es = new EmailService(c.env, tenantId);
        await es.sendEmail(c, {
          to: email,
          subject: "Verify your email address",
          content: `<p>Welcome to mailroute! Click the link to verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
        });
      } catch (err) {
        console.error("Failed to send verification email:", err);
      }
    })(),
  );

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

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

async function checkLoginRateLimit(db: ReturnType<typeof drizzle>, email: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MS).toISOString();
  const result = await db
    .select({ count: drizzleCount() })
    .from(LoginAttempt)
    .where(and(eq(LoginAttempt.email, email), gt(LoginAttempt.attemptedAt, cutoff)))
    .get();
  return (result?.count ?? 0) >= LOGIN_MAX_ATTEMPTS;
}

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const { email, password } = c.req.valid("json");

  const rateLimited = await checkLoginRateLimit(db, email);
  if (rateLimited) {
    return c.json(ApiResponse(false, "Too many login attempts. Please try again later."), 429);
  }

  const user = await db.select().from(User).where(eq(User.email, email)).get();
  if (!user) {
    c.executionCtx.waitUntil(
      db.insert(LoginAttempt).values({
        id: crypto.randomUUID(),
        email,
        ip: c.req.header("cf-connecting-ip") || "",
        attemptedAt: new Date().toISOString(),
      }).execute().catch(() => {}),
    );
    return c.json(ApiResponse(false, "Invalid email or password"), 401);
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    c.executionCtx.waitUntil(
      db.insert(LoginAttempt).values({
        id: crypto.randomUUID(),
        email,
        ip: c.req.header("cf-connecting-ip") || "",
        attemptedAt: new Date().toISOString(),
      }).execute().catch(() => {}),
    );
    return c.json(ApiResponse(false, "Invalid email or password"), 401);
  }

  c.executionCtx.waitUntil(
    db.delete(LoginAttempt).where(eq(LoginAttempt.email, email)).execute().catch(() => {}),
  );

  const tenant = await db.select().from(Tenant).where(eq(Tenant.id, user.tenantId)).get();
  if (!tenant) return c.json(ApiResponse(false, "Tenant not found"), 404);

  const token = await signJWT(
    { sub: user.id, tenantId: user.tenantId, role: user.role },
    c.env.JWT_SECRET,
    JWT_EXPIRY_SEC,
  );
  const refreshToken = await signJWT(
    { sub: user.id, tenantId: user.tenantId, role: user.role },
    c.env.JWT_SECRET,
    REFRESH_EXPIRY_SEC,
  );
  setAuthCookies(c, token, refreshToken);

  return c.json(ApiResponse(true, null, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
    token,
  }));
});

const forgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

auth.post("/forgot-password", zValidator("json", forgotPasswordSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const { email } = c.req.valid("json");

  const user = await db.select().from(User).where(eq(User.email, email)).get();
  if (!user) return c.json(ApiResponse(false, "If that email exists, a reset link has been sent"), 200);

  const token = await generateResetToken(email, c.env.JWT_SECRET);
  const resetUrl = `${new URL(c.req.url).origin}/admin/reset-password?token=${token}`;

  c.executionCtx.waitUntil(
    (async () => {
      try {
        const emailService = new EmailService(c.env, user.tenantId);
        await emailService.sendEmail(c, {
          to: email,
          subject: "Password Reset Request",
          content: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in 15 minutes.</p>`,
        });
      } catch (err) {
        console.error("Failed to send reset email:", err);
        console.log("RESET_PASSWORD_LINK:", resetUrl);
      }
    })(),
  );

  return c.json(ApiResponse(true, "If that email exists, a reset link has been sent"));
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

auth.post("/reset-password", zValidator("json", resetPasswordSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const { token, password } = c.req.valid("json");

  const payload = await verifyResetToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json(ApiResponse(false, "Invalid or expired token"), 400);

  const user = await db.select().from(User).where(eq(User.email, payload.email)).get();
  if (!user) return c.json(ApiResponse(false, "User not found"), 404);

  const passwordHash = await hashPassword(password);
  await db.update(User).set({ passwordHash }).where(eq(User.id, user.id)).execute();

  return c.json(ApiResponse(true, "Password reset successfully"));
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

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
});

auth.post("/change-password", requireAuth, RateLimitMiddleware, zValidator("json", changePasswordSchema), async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const userId = c.get("userId");
  const { currentPassword, newPassword } = c.req.valid("json");

  const user = await db.select().from(User).where(eq(User.id, userId)).get();
  if (!user) return c.json(ApiResponse(false, "User not found"), 404);

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return c.json(ApiResponse(false, "Current password is incorrect"), 403);

  const passwordHash = await hashPassword(newPassword);
  await db.update(User).set({ passwordHash }).where(eq(User.id, userId)).execute();

  return c.json(ApiResponse(true, "Password changed successfully"));
});

auth.post("/refresh", async (c) => {
  const refreshToken = getCookie(c, "refresh_token");
  if (!refreshToken) {
    return c.json(ApiResponse(false, "No refresh token"), 401);
  }
  const payload = await verifyJWT(refreshToken, c.env.JWT_SECRET);
  if (!payload) {
    clearAuthCookies(c);
    return c.json(ApiResponse(false, "Invalid or expired refresh token"), 401);
  }
  const newToken = await signJWT(
    { sub: payload.sub, tenantId: payload.tenantId, role: payload.role },
    c.env.JWT_SECRET,
    JWT_EXPIRY_SEC,
  );
  const newRefreshToken = await signJWT(
    { sub: payload.sub, tenantId: payload.tenantId, role: payload.role },
    c.env.JWT_SECRET,
    REFRESH_EXPIRY_SEC,
  );
  setAuthCookies(c, newToken, newRefreshToken);
  return c.json(ApiResponse(true, null, { token: newToken }));
});

auth.post("/logout", requireAuth, async (c) => {
  clearAuthCookies(c);
  return c.json(ApiResponse(true, "Logged out"));
});

auth.get("/verify-email", async (c) => {
  const token = c.req.query("token");
  if (!token) return c.json(ApiResponse(false, "Missing verification token"), 400);

  const db = drizzle(c.env.D1_DATABASE);
  const user = await db.select().from(User).where(eq(User.verificationToken, token)).get();
  if (!user) return c.json(ApiResponse(false, "Invalid or expired verification token"), 400);

  await db.update(User).set({ emailVerified: true, verificationToken: null }).where(eq(User.id, user.id)).execute();

  return c.json(ApiResponse(true, "Email verified successfully"));
});

export async function requireAuth(
  c: Context<AppEnv>,
  next: Next,
) {
  let token: string | undefined;

  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    token = getCookie(c, "auth_token");
  }

  if (!token) {
    return c.json(ApiResponse(false, "Authentication required"), 401);
  }

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json(ApiResponse(false, "Invalid or expired token"), 401);
  }
  c.set("userId", payload.sub);
  c.set("tenantId", payload.tenantId);
  c.set("userRole", payload.role);
  await next();
}

export default auth;
