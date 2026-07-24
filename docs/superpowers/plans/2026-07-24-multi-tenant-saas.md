# Multi-Tenant SaaS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.
>
> **Goal:** Transform the single-tenant email microservice into a multi-tenant SaaS platform where users can sign up, create/manage their own email configuration, and send emails through their own vendor setup. Keep the current deployed instance as a demo.
>
> **Architecture:** Shared D1 database with `tenant_id` column for row-level isolation. JWT-based auth for admin SPA users. Existing API key auth preserved for public send endpoints (but scoped per-tenant). Path-based routing derived from JWT session, no subdomain changes needed.
>
> **Tech Stack:** Hono, Drizzle ORM, D1 SQLite, Zod, JWT (via Web Crypto), bcrypt (via Web Crypto PBKDF2), React, TipTap, Motion

## Global Constraints

- All new DB migrations go in `migrations/` as numbered SQL files
- All changes must keep the existing public API (`/api/send-otp`, `/api/send-email`, `/api/send-template`) backwards-compatible (API key auth still works, but resolves to the owner tenant)
- The deployed demo at `mailroute.finchtech-my.workers.dev` must keep working after each phase
- JWT secrets from env var (`JWT_SECRET`), never hardcoded
- Password hashing via PBKDF2-SHA256 (Web Crypto API), never plaintext
- Admin SPA keeps its existing component patterns (motion spring animations, card-based layout, Toast notifications)
- Every new DB column gets a `tenant_id` text field, indexed, non-nullable for tenant-scoped tables
- The `*` service in `service_config` becomes tenant-specific — demo tenant seeds its own defaults

---
## File Change Map

### New files to create:
| File | Purpose |
|------|---------|
| `migrations/0005_tenants.sql` | Create `tenants` table |
| `migrations/0006_users.sql` | Create `users` table (password_hash, role) |
| `migrations/0007_sessions.sql` | Create `sessions` table (JWT refresh tokens) |
| `migrations/0008_add_tenant_id.sql` | Add `tenant_id` columns to all existing tables |
| `src/db/schema.ts` | **(modified)** Add tenant, user, session tables |
| `src/lib/jwt.ts` | JWT sign/verify using Web Crypto HMAC-SHA256 |
| `src/lib/password.ts` | PBKDF2-SHA256 hash/verify |
| `src/middlewares/auth.middleware.ts` | JWT validation + tenant context middleware |
| `src/middlewares/tenant.middleware.ts` | Extract/attach tenant context from session |
| `src/routes/auth.routes.ts` | Signup, login, logout, me endpoints |
| `admin/src/pages/Login.tsx` | Login/signup page (replaces AuthScreen in Layout) |
| `admin/src/pages/Signup.tsx` | Tenant registration form |
| `admin/src/pages/Settings.tsx` | Tenant settings (name, API key regen) |
| `admin/src/api/auth.ts` | Auth API client (login, signup, logout, me) |
| `scripts/seed-demo-data.sql` | Seed data for the demo tenant |

### Existing files to modify:
| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add Tenant, User, Session tables; add tenantId to all existing tables |
| `src/routes/admin.routes.ts` | All queries scoped by `tenant_id` from context |
| `src/routes/general.routes.ts` | API key auth resolves tenant; send ops scoped |
| `src/services/email-template.service.ts` | Accept `tenant_id` in constructor/query |
| `src/services/email-vendor.service.ts` | Accept `tenant_id` in constructor/query |
| `src/services/config.service.ts` | Accept `tenant_id` in constructor/query |
| `src/middlewares/api-auth-key.middleware.ts` | On auth, resolve tenant_id and attach to context |
| `src/index.ts` | Mount auth routes, update middleware order |
| `admin/src/api/client.ts` | Add JWT token to requests, handle 401 → login redirect |
| `admin/src/components/Layout.tsx` | Replace AuthScreen with login route; add nav items |
| `admin/src/App.tsx` | Add login/signup/settings routes |
| `admin/src/types.ts` | Add auth-related interfaces |
| `wrangler.jsonc` | Add `JWT_SECRET` env var binding |

---

## Phase 1 — Database & Auth Foundation

### Task 1.1: Add Tenant, User, and Session tables to Drizzle schema

**Files:**
- Create: `migrations/0005_tenants.sql`
- Create: `migrations/0006_users.sql`
- Create: `migrations/0007_sessions.sql`
- Create: `migrations/0008_add_tenant_id.sql`
- Modify: `src/db/schema.ts`

**Interfaces:**
- Produces: Exports `Tenant`, `User`, `Session` table definitions + `tenantId` columns on existing tables

- [ ] **Step 1: Create migration 0005_tenants.sql**

```sql
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  api_auth_key_hash TEXT,  -- SHA-256 hash of the tenant's API key (nullable until generated)
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tenants_slug ON tenants(slug);
```

- [ ] **Step 2: Create migration 0006_users.sql**

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'member')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
```

- [ ] **Step 3: Create migration 0007_sessions.sql**

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL,       -- SHA-256 of refresh token
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
```

- [ ] **Step 4: Create migration 0008_add_tenant_id.sql**

```sql
-- email_templates
ALTER TABLE email_templates ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_email_templates_tenant ON email_templates(tenant_id);

-- email_vendors
ALTER TABLE email_vendors ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_email_vendors_tenant ON email_vendors(tenant_id);

-- service_config
ALTER TABLE service_config ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_service_config_tenant ON service_config(tenant_id);

-- send_logs
ALTER TABLE send_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_send_logs_tenant ON send_logs(tenant_id);

-- activity_logs
ALTER TABLE activity_logs ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_activity_logs_tenant ON activity_logs(tenant_id);

-- push_subscriptions
ALTER TABLE push_subscriptions ADD COLUMN tenant_id TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_push_subscriptions_tenant ON push_subscriptions(tenant_id);
```

- [ ] **Step 5: Update Drizzle schema in `src/db/schema.ts`**

Add after the existing imports (around line 3):
```ts
import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
```

Add before `EmailTemplate`:
```ts
export const Tenant = sqliteTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  apiAuthKeyHash: text("api_auth_key_hash"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const User = sqliteTable("users", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => Tenant.id),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull().default(""),
  role: text("role").notNull().default("admin"),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").$defaultFn(() => new Date().toISOString()),
});

export const Session = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => User.id),
  tokenHash: text("token_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").$defaultFn(() => new Date().toISOString()),
});
```

Add `tenantId` to each existing table definition. Example for `EmailTemplate`:
```ts
export const EmailTemplate = sqliteTable("email_templates", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().default(""),
  slug: text("slug").notNull().unique(),
  // ... rest unchanged
});
```

Same pattern for `ServiceConfig`, `EmailVendor`, `SendLog`, `ActivityLog`, `PushSubscription` — add `tenantId: text("tenant_id").notNull().default("")` as the second field in each.

- [ ] **Step 6: Add TypeScript interfaces for auth types in `admin/src/types.ts`**

```ts
export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;  // seconds
}

export interface LoginResponse {
  success: boolean;
  message: string | null;
  data: {
    user: UserInfo;
    tenant: TenantInfo;
    token: string;   // JWT access token
    refreshToken: string;
  } | null;
}

export interface SignupResponse {
  success: boolean;
  message: string | null;
  data: {
    user: UserInfo;
    tenant: TenantInfo;
    token: string;
  } | null;
}
```

- [ ] **Step 7: Commit**

```bash
git add migrations/0005_tenants.sql migrations/0006_users.sql migrations/0007_sessions.sql migrations/0008_add_tenant_id.sql src/db/schema.ts admin/src/types.ts
git commit -m "feat: add tenant, user, session tables and tenant_id columns"
```

---

### Task 1.2: JWT utilities and password hashing

**Files:**
- Create: `src/lib/jwt.ts`
- Create: `src/lib/password.ts`

**Interfaces:**
- Produces: `signJWT(payload, secret)`, `verifyJWT(token, secret)`, `hashPassword(password)`, `verifyPassword(password, hash)`

- [ ] **Step 1: Create `src/lib/jwt.ts`**

```ts
export interface JwtPayload {
  sub: string;       // user_id
  tenantId: string;  // tenant_id
  role: string;
  exp: number;       // unix timestamp
  iat: number;       // unix timestamp
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" },
    false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export async function signJWT(
  payload: Omit<JwtPayload, "iat" | "exp">,
  secret: string,
  expiresInSec = 3600,
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSec;
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify({ ...payload, iat, exp }));
  const signature = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = await hmacSign(`${header}.${body}`, secret);
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(atob(body));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload as JwtPayload;
  } catch { return null; }
}
```

- [ ] **Step 2: Create `src/lib/password.ts`**

```ts
async function pbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<{ hash: Uint8Array; salt: Uint8Array }> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    key, 256,
  );
  return { hash: new Uint8Array(bits), salt };
}

function toBase64url(buf: Uint8Array): string {
  return btoa(String.fromCharCode(...buf))
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64url(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

const ITERATIONS = 100_000;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const { hash } = await pbkdf2(password, salt, ITERATIONS);
  return `${ITERATIONS}:${toBase64url(salt)}:${toBase64url(hash)}`;
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split(":");
  if (parts.length !== 3) return false;
  const [iters, saltB64, hashB64] = parts;
  const salt = fromBase64url(saltB64);
  const { hash } = await pbkdf2(password, salt, parseInt(iters, 10));
  return toBase64url(hash) === hashB64;
}

// Generate a cryptographically random API key
export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "mr_" + toBase64url(bytes);
}

// Hash an API key for storage (SHA-256)
export async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(apiKey));
  return toBase64url(new Uint8Array(hash));
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/jwt.ts src/lib/password.ts
git commit -m "feat: add JWT sign/verify and PBKDF2 password hashing"
```

---

### Task 1.3: Auth routes (signup, login, logout, me)

**Files:**
- Create: `src/routes/auth.routes.ts`
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `signJWT`, `verifyJWT`, `hashPassword`, `verifyPassword`, `generateApiKey`, `hashApiKey` from lib
- Consumes: `Tenant`, `User`, `Session` from schema
- Produces: `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`

- [ ] **Step 1: Create `src/routes/auth.routes.ts`**

```ts
import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { Tenant, User, Session } from "../db/schema";
import { signJWT, verifyJWT } from "../lib/jwt";
import { hashPassword, verifyPassword, generateApiKey, hashApiKey } from "../lib/password";
import { ApiResponse } from "../utils/response.util";
import type { CloudflareBindings } from "../lib/cloudflare.binding";

const auth = new Hono<{ Bindings: CloudflareBindings }>();

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

  // Check if email already taken
  const existingUser = await db.select().from(User).where(eq(User.email, email)).get();
  if (existingUser) {
    return c.json(ApiResponse(false, "Email already registered"), 409);
  }

  // Check if slug taken
  const existingTenant = await db.select().from(Tenant).where(eq(Tenant.slug, tenantSlug)).get();
  if (existingTenant) {
    return c.json(ApiResponse(false, "Tenant slug already taken"), 409);
  }

  // Hash password, generate API key
  const passwordHash = await hashPassword(password);
  const apiKey = generateApiKey();
  const apiKeyHash = await hashApiKey(apiKey);
  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();

  // Create tenant
  await db.insert(Tenant).values({
    id: tenantId, name: tenantName, slug: tenantSlug, apiAuthKeyHash: apiKeyHash,
  }).execute();

  // Create user
  await db.insert(User).values({
    id: userId, tenantId, email, passwordHash, name, role: "admin",
  }).execute();

  // Sign JWT
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

// Auth middleware for protected routes
export async function requireAuth(
  c: { env: CloudflareBindings; req: { header(name: string): string | null }; set(key: string, val: unknown): void },
  next: () => Promise<void>,
) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return Response.json(ApiResponse(false, "Missing Authorization header"), { status: 401 });
  }
  const payload = await verifyJWT(header.slice(7), c.env.JWT_SECRET);
  if (!payload) {
    return Response.json(ApiResponse(false, "Invalid or expired token"), { status: 401 });
  }
  c.set("userId", payload.sub);
  c.set("tenantId", payload.tenantId);
  c.set("userRole", payload.role);
  await next();
}

auth.get("/me", requireAuth, async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const userId = (c as any).get("userId");
  const tenantId = (c as any).get("tenantId");

  const user = await db.select().from(User).where(eq(User.id, userId)).get();
  const tenant = await db.select().from(Tenant).where(eq(Tenant.id, tenantId)).get();
  if (!user || !tenant) return c.json(ApiResponse(false, "Not found"), 404);

  return c.json(ApiResponse(true, null, {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
  }));
});

auth.post("/logout", requireAuth, async (c) => {
  // Client should discard the token. Server-side: no-op for JWT (stateless).
  // If using refresh tokens, would delete from sessions table here.
  return c.json(ApiResponse(true, "Logged out"));
});

export default auth;
```

- [ ] **Step 2: Mount auth routes in `src/index.ts`**

Add import:
```ts
import authRoutes from "./routes/auth.routes";
```

Mount before admin routes (around line 50):
```ts
app.route("/api/auth", authRoutes);
```

Add `JWT_SECRET` to `CloudflareBindings` in `src/lib/cloudflare.binding.ts`:
```ts
JWT_SECRET: string;
```

- [ ] **Step 3: Add `JWT_SECRET` to `wrangler.jsonc` vars**

```json
"vars": {
  "JWT_SECRET": ""
}
```

And add to `wrangler.jsonc.example`:
```json
"vars": {
  "JWT_SECRET": "<YOUR_JWT_SECRET>"
}
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/auth.routes.ts src/index.ts src/lib/cloudflare.binding.ts wrangler.jsonc wrangler.jsonc.example
git commit -m "feat: add auth routes (signup, login, me, logout)"
```

---

## Phase 2 — Tenant-scoped Admin API

### Task 2.1: Add tenant context middleware to admin routes

**Files:**
- Modify: `src/routes/admin.routes.ts`

**Interfaces:**
- Consumes: `requireAuth` from auth.routes
- Produces: All admin routes scoped to `c.get("tenantId")`

- [ ] **Step 1: Update admin routes import**

```ts
import { requireAuth } from "./auth.routes";
```

- [ ] **Step 2: Replace `ApiAuthKeyMiddleware` with `requireAuth` on admin router**

In `admin.routes.ts`, change the admin router instantiation from:
```ts
const admin = new Hono<{ Bindings: CloudflareBindings }>();
admin.use("*", ApiAuthKeyMiddleware);
admin.use("*", RateLimitMiddleware);
```

To:
```ts
const admin = new Hono<{ Bindings: CloudflareBindings }>();
admin.use("*", requireAuth);
admin.use("*", RateLimitMiddleware);
```

- [ ] **Step 3: Tenant-scope every query in admin routes**

For each query, add `.where(eq(Table.tenantId, c.get("tenantId")))`.

Example for vendors list (line 43):
```ts
admin.get("/vendors", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const rows = await db.select()
    .from(EmailVendor)
    .where(eq(EmailVendor.tenantId, tenantId))
    .all();
  return c.json(ApiResponse(true, null, rows));
});
```

Do this for every admin route that reads/writes data:
- `GET /vendors`
- `POST /vendors` — add `tenantId` to insert values
- `PUT /vendors/:id` — add `tenantId` to where clause
- `DELETE /vendors/:id` — add `tenantId` to where clause
- `GET /templates` — add `tenantId` to where
- `POST /templates` — add `tenantId` to insert
- `PUT /templates/:id` — add `tenantId` to where
- `DELETE /templates/:id` — add `tenantId` to where
- `GET /config` — add `tenantId` to where
- `POST /config` — add `tenantId` to insert values
- `PUT /config/:service/:key` — add `tenantId` to where
- `POST /config/:service/:key/encrypt` — add `tenantId`
- `POST /config/:service/:key/decrypt` — add `tenantId`
- `POST /config/:service/:key/rotate` — add `tenantId`
- `DELETE /config/:service/:key` — add `tenantId`
- `GET /stats` — add `tenantId`
- `GET /logs` — add `tenantId`
- `POST /test-send` — add `tenantId` to send_log insert
- `POST /push/subscribe` — add `tenantId` to insert
- `DELETE /push/subscribe` — add `tenantId` to where

- [ ] **Step 4: Commit**

```bash
git add src/routes/admin.routes.ts
git commit -m "feat: scope admin API by tenant_id from JWT"
```

---

### Task 2.2: Scope public API and services by tenant

**Files:**
- Modify: `src/routes/general.routes.ts`
- Modify: `src/services/email-template.service.ts`
- Modify: `src/services/email-vendor.service.ts`
- Modify: `src/services/config.service.ts`
- Modify: `src/middlewares/api-auth-key.middleware.ts`

**Interfaces:**
- Consumes: `Tenant` from schema, `hashApiKey` from lib
- Produces: API key auth resolves `tenantId`; services accept `tenantId`

- [ ] **Step 1: Update `api-auth-key.middleware.ts` to resolve tenant**

```ts
// After confirming the API key is valid, look up the tenant:
import { Tenant } from "../db/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

// Inside the middleware, after resolving expectedKey:
// Instead of comparing against a single global key, look up the key in tenants table:
const db = drizzle(c.env.D1_DATABASE);
const allTenants = await db.select({
  id: Tenant.id,
  apiAuthKeyHash: Tenant.apiAuthKeyHash,
}).from(Tenant).all();

const encoder = new TextEncoder();
const providedHash = await crypto.subtle.digest(
  "SHA-256", encoder.encode(apiKey),
);
const providedB64 = btoa(String.fromCharCode(...new Uint8Array(providedHash)))
  .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

const matchedTenant = allTenants.find((t) => t.apiAuthKeyHash === providedB64);
if (!matchedTenant) {
  return c.json(ApiResponse(false, "Unauthorized: Invalid API key"), 401);
}

// Attach tenantId to context
c.set("tenantId", matchedTenant.id);
await next();
```

- [ ] **Step 2: Update `EmailTemplateService` to accept `tenantId`**

```ts
export class EmailTemplateService {
  private db: ReturnType<typeof drizzle>;
  constructor(
    private env: CloudflareBindings,
    private tenantId: string,
  ) {
    this.db = drizzle(env.D1_DATABASE);
  }

  async getProcessedTemplate(slug: string, replacements: Record<string, string>) {
    const template = await this.db
      .select()
      .from(EmailTemplate)
      .where(
        and(eq(EmailTemplate.slug, slug), eq(EmailTemplate.tenantId, this.tenantId)),
      )
      .get();
    // ... rest unchanged
  }
}
```

- [ ] **Step 3: Update `EmailVendorService` to accept `tenantId`**

```ts
export class EmailVendorService {
  constructor(
    private env: CloudflareBindings,
    private tenantId: string,
  ) {}
  // In getActiveVendors(), add: .where(and(eq(EmailVendor.enabled, true), eq(EmailVendor.tenantId, this.tenantId)))
}
```

- [ ] **Step 4: Update `ConfigService` to accept `tenantId`**

```ts
export class ConfigService {
  constructor(
    private env: CloudflareBindings,
    private tenantId: string,
  ) {}
  // In load(), add: .where(and(eq(ServiceConfig.service, SERVICE_NAME), eq(ServiceConfig.tenantId, this.tenantId)))
}
```

- [ ] **Step 5: Update `EmailService` constructor to pass `tenantId`**

```ts
export class EmailService {
  constructor(
    private env: CloudflareBindings,
    private tenantId: string,
  ) {
    this.vendorService = new EmailVendorService(env, tenantId);
  }
}
```

- [ ] **Step 6: Update all callers in general.routes.ts and admin.routes.ts**

Every `new EmailService(c.env)` becomes `new EmailService(c.env, c.get("tenantId"))`.
Every `new EmailTemplateService(c.env)` becomes `new EmailTemplateService(c.env, c.get("tenantId"))`.

In the `/send-email` and `/send-template` public endpoints, the tenantId comes from the API key auth middleware (attached to context).

In admin routes, the tenantId comes from the JWT auth middleware.

- [ ] **Step 7: Commit**

```bash
git add src/routes/general.routes.ts src/services/email-template.service.ts src/services/email-vendor.service.ts src/services/config.service.ts src/services/email.service.ts src/middlewares/api-auth-key.middleware.ts
git commit -m "feat: scope services and public API by tenant_id"
```

---

## Phase 3 — Admin SPA Auth UI

### Task 3.1: Auth API client and Login/Signup pages

**Files:**
- Create: `admin/src/api/auth.ts`
- Create: `admin/src/pages/Login.tsx`
- Create: `admin/src/pages/Signup.tsx`
- Modify: `admin/src/api/client.ts`

- [ ] **Step 1: Create `admin/src/api/auth.ts`**

```ts
import { post, get } from "./client";
import type { ApiResponse, LoginResponse, SignupResponse, UserInfo, TenantInfo } from "../types";

export function login(email: string, password: string): Promise<ApiResponse<LoginResponse["data"]>> {
  return post("/auth/login", { email, password });
}

export function signup(data: {
  name: string;
  email: string;
  password: string;
  tenantName: string;
  tenantSlug: string;
}): Promise<ApiResponse<SignupResponse["data"]>> {
  return post("/auth/signup", data);
}

export function getMe(): Promise<ApiResponse<{ user: UserInfo; tenant: TenantInfo }>> {
  return get("/auth/me");
}

export function logout(): Promise<ApiResponse<null>> {
  return post("/auth/logout", {});
}
```

- [ ] **Step 2: Update `admin/src/api/client.ts` to support JWT auth**

Add a `tokenStorage` alongside the existing `apiKeyStorage`:

```ts
const API_BASE = "/api/admin";

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("mailroute_token");
  if (token) return { Authorization: `Bearer ${token}` };
  const apiKey = localStorage.getItem("mailroute_api_key");
  if (apiKey) return { "X-API-AUTH-KEY": apiKey };
  return {};
}

export function setToken(token: string) {
  localStorage.setItem("mailroute_token", token);
}

export function clearToken() {
  localStorage.removeItem("mailroute_token");
}

export function hasToken(): boolean {
  return !!localStorage.getItem("mailroute_token");
}

// Update get/post/put/del to use getAuthHeaders() instead of just X-API-AUTH-KEY
// Change the 401 handler: if token exists, clear and redirect to /admin/login
```

- [ ] **Step 3: Create `admin/src/pages/Login.tsx`**

Full login page with:
- Email + password inputs using Apple-style grouped form fields (same pattern as TestSend.tsx)
- "Sign in" button (full width, accent color)
- Error banner for invalid credentials
- Loading state on submit
- Link to signup page
- On success: store token via `setToken()`, navigate to `/`
- Also include a "Use API Key" toggle for existing single-tenant mode

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { login } from "../api/auth";
import { setToken } from "../api/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(email, password);
      if (res.success && res.data) {
        setToken(res.data.token);
        navigate("/");
      } else {
        setError(res.message || "Login failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ maxWidth: 400, margin: "80px auto 0", padding: "0 20px" }}
    >
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 4 }}>mailroute</h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: 0 }}>Sign in to your account</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, border: "1px solid var(--border)", overflow: "hidden", marginBottom: 20 }}>
          <div style={{ padding: "12px 14px 0" }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Email</label>
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: "100%", border: "none", background: "transparent", padding: "0 14px 12px", fontSize: 15, outline: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
          />
          <div style={{ height: 1, background: "var(--border)", margin: "0 14px" }} />
          <div style={{ padding: "12px 14px 0" }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" }}>Password</label>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", border: "none", background: "transparent", padding: "0 14px 12px", fontSize: 15, outline: "none", color: "var(--text-primary)", fontFamily: "var(--font-sans)" }}
          />
        </div>

        {error && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,69,58,0.1)", color: "#c0392b", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        <motion.button
          type="submit"
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "none", background: loading ? "var(--accent-dimmed, #0071e366)" : "var(--accent)", color: "#fff", fontSize: 16, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", marginBottom: 16 }}
        >
          {loading ? "Signing in…" : "Sign In"}
        </motion.button>

        <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-secondary)" }}>
          No account?{" "}
          <Link to="/signup" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>Create one</Link>
        </p>
      </form>
    </motion.div>
  );
}
```

- [ ] **Step 4: Create `admin/src/pages/Signup.tsx`**

Follow same pattern as Login.tsx but with fields:
- Tenant Name (e.g. "My Company")
- Tenant Slug (e.g. "my-company" — shown as preview URL)
- Your Name
- Email
- Password (min 8)
- On success: store token + API key, navigate to `/` with a welcome toast showing the API key

- [ ] **Step 5: Commit**

```bash
git add admin/src/api/auth.ts admin/src/pages/Login.tsx admin/src/pages/Signup.tsx admin/src/api/client.ts
git commit -m "feat: add auth API client and login/signup pages"
```

---

### Task 3.2: Update Layout and routing for auth

**Files:**
- Modify: `admin/src/components/Layout.tsx`
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/api/client.ts` (update 401 handling)

- [ ] **Step 1: Add login/signup routes to `App.tsx`**

```tsx
const LoginPage = lazy(() => import("./pages/Login"));
const SignupPage = lazy(() => import("./pages/Signup"));

// Add routes:
<Route path="/login" element={<LoginPage />} />
<Route path="/signup" element={<SignupPage />} />
```

- [ ] **Step 2: Update `Layout.tsx`** 

Replace the `AuthScreen` check with a token check that redirects to `/login`:

```tsx
// At the top of Layout component:
const token = hasToken();
const navigate = useNavigate();
const location = useLocation();

useEffect(() => {
  if (!token && location.pathname !== "/login" && location.pathname !== "/signup") {
    navigate("/login", { replace: true });
  }
}, [token, location.pathname]);
```

- [ ] **Step 3: Update `client.ts` 401 handling**

On 401, check if we have a token:
- If token exists: clear token and redirect to `/login`
- If no token (using API key): keep existing behavior (clear API key and reload)

- [ ] **Step 4: Commit**

```bash
git add admin/src/components/Layout.tsx admin/src/App.tsx admin/src/api/client.ts
git commit -m "feat: integrate auth into layout and routing"
```

---

## Phase 4 — Demo Tenant & Open Source Polish

### Task 4.1: Create demo data seeder

**Files:**
- Create: `scripts/seed-demo-data.sql`
- Create: `src/routes/admin.routes.ts` (add demo reset endpoint, optional)

- [ ] **Step 1: Create `scripts/seed-demo-data.sql`**

Insert a demo tenant with pre-seeded vendors, templates, and config:

```sql
-- Demo tenant
INSERT OR IGNORE INTO tenants (id, name, slug, api_auth_key_hash, created_at, updated_at)
VALUES ('demo-tenant-id', 'Demo Company', 'demo', '<SHA256_OF_DEMO_API_KEY>', datetime('now'), datetime('now'));

-- Demo user (email: demo@mailroute.dev, password: "demo1234" – CHANGE BEFORE PUBLISHING)
INSERT OR IGNORE INTO users (id, tenant_id, email, password_hash, name, role, created_at, updated_at)
VALUES ('demo-user-id', 'demo-tenant-id', 'demo@mailroute.dev', '<PBKDF2_HASH>', 'Demo User', 'admin', datetime('now'), datetime('now'));

-- Demo vendors (Sender.net + Brevo with placeholder tokens)
INSERT OR IGNORE INTO email_vendors (id, tenant_id, name, enabled, priority, api_endpoint, api_token, from_email, from_name, created_at, updated_at)
VALUES
  ('demo-sender', 'demo-tenant-id', 'sender', 1, 1, 'https://api.sender.net/v2/subscribers/send', '<YOUR_DEMO_TOKEN>', 'demo@finchtech.my', 'MailRoute Demo', datetime('now'), datetime('now')),
  ('demo-brevo', 'demo-tenant-id', 'brevo', 0, 2, 'https://api.brevo.com/v3/smtp/email', '<YOUR_DEMO_TOKEN>', 'demo@finchtech.my', 'MailRoute Demo', datetime('now'), datetime('now'));

-- Demo templates
INSERT OR IGNORE INTO email_templates (id, tenant_id, slug, subject, content, created_at, updated_at)
VALUES
  ('demo-welcome', 'demo-tenant-id', 'welcome', 'Welcome to {{app_name}}, {{name}}!', '<h1>Welcome!</h1><p>Hi {{name}}, thanks for joining {{app_name}}.</p>', datetime('now'), datetime('now')),
  ('demo-otp', 'demo-tenant-id', 'otp-verification', 'Your verification code', '<h2>Your code: <strong>{{code}}</strong></h2><p>Enter this code to verify your account.</p>', datetime('now'), datetime('now'));

-- Demo config (shared)
INSERT OR IGNORE INTO service_config (tenant_id, service, key, value, updated_at)
VALUES
  ('demo-tenant-id', '*', 'APP_ENVIRONMENT', 'demo', datetime('now')),
  ('demo-tenant-id', '*', 'APP_URL', 'https://mailroute.finchtech-my.workers.dev', datetime('now'));
```

- [ ] **Step 2: Update README with demo credentials**

Add a "Demo" section to `README.md`:
```md
## Demo

A live demo is available at **https://mailroute.finchtech-my.workers.dev/admin**

**Demo credentials:**
- Email: `demo@mailroute.dev`
- Password: `demo1234`

The demo resets every 24 hours. Pre-seeded with sample templates and vendor configurations.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-demo-data.sql README.md
git commit -m "feat: add demo tenant seeder and update README with demo credentials"
```

---

### Task 4.2: Add demo reset cron trigger (optional)

**Files:**
- Modify: `src/index.ts`

Add a scheduled cron handler that resets demo data daily:

```ts
// In src/index.ts
app.get("/__cron/reset-demo", async (c) => {
  // Verify cron secret header
  // Delete and re-seed demo tenant data
  // Return 200
});
```

This is optional — the seeder uses `INSERT OR IGNORE` so running it again is idempotent.

- [ ] **Step 1: Add cron route to reset demo data**

---

## Phase 5 — Future (Post-MVP)

The following are NOT part of this plan but documented for future reference:

| Feature | Approach |
|---------|----------|
| **Billing** | Stripe integration with usage-based pricing per email sent |
| **API key management** | UI to generate/revoke API keys per tenant (multiple keys) |
| **Team management** | Invite members, roles (admin/member/viewer) |
| **Usage analytics** | Per-tenant send volume, success rates, charts |
| **Custom domains** | Per-tenant domain for send endpoints |
| **Email webhooks** | Per-tenant webhook for delivery status |
| **Rate limit tiers** | Per-tenant configurable rate limits |
| **Data export** | CSV/JSON export of logs per tenant |
| **Tenant deletion** | Cascade delete all tenant data |

---

## Self-Review

**Spec coverage check:**
1. ✅ Tenant isolation via `tenant_id` column pattern
2. ✅ User auth with JWT + PBKDF2 password hashing
3. ✅ Signup creates tenant + admin user + API key
4. ✅ Existing API key auth still works (but resolves tenant)
5. ✅ Admin SPA gets login/signup pages
6. ✅ Demo tenant with seed data
7. ✅ README updated with demo credentials
8. ✅ All existing endpoints backwards-compatible

**Placeholder scan:**
- `<SHA256_OF_DEMO_API_KEY>` and `<PBKDF2_HASH>` in seed-demo-data.sql — these need real values computed at seed time. The seed script should be run by the admin, not checked in with real hashes. Change to `wrangler d1 execute` commands or a seed script that generates them.
- `<YOUR_DEMO_TOKEN>` in vendor seeds — needs real tokens for the demo to actually send emails. Document that these must be set before running the demo.

**Type consistency check:**
- `LoginResponse.data` matches `signup` response shape — both return `{ user, tenant, token }`
- `requireAuth` sets `userId`, `tenantId`, `userRole` — matches all admin route getters
- `EmailTemplateService` constructor changed to accept `(env, tenantId)` — all callers updated
- JWT payload `sub` is `userId`, matches `c.get("userId")`

---

## Summary

| Phase | Tasks | Files Changed | Effort |
|-------|-------|--------------|--------|
| 1 — Database & Auth Foundation | 1.1–1.3 | 12 files | Medium |
| 2 — Tenant-scoped API | 2.1–2.2 | 8 files | Medium |
| 3 — Admin SPA Auth UI | 3.1–3.2 | 6 files | Medium |
| 4 — Demo & Polish | 4.1–4.2 | 4 files | Small |
| **Total** | **8 tasks** | **~25 files** | **Large** |
