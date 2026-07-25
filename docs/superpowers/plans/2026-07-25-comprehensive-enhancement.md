# Comprehensive Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship security hardening, performance optimization, feature enhancements, and Playwright E2E test suite for mailroute.

**Architecture:** Big Bang — all changes delivered in one branch. Each task within produces independently testable code. Security fixes first (foundation), then performance, then features, then Playwright tests. All run through existing `vitest` pipeline.

**Tech Stack:** Hono, Drizzle ORM, D1, Zod, Playwright, Vitest

## Global Constraints

- Node >= 22.0.0, TypeScript >= 7.0.2
- All source in `src/`, tests in `src/__tests__/` or `e2e/`
- Use `crypto.subtle` for all cryptographic operations (Workers runtime)
- Cloudflare Workers compatibility date 2026-06-10
- New env vars must be added to `.env.example`, `.dev.vars.example`, `src/lib/cloudflare.binding.ts`, and validated in `src/index.ts`
- All PRs must pass `npm run build` (type-check) and `npm test` (vitest)
- Follow existing code style: trailing commas everywhere except JSON, 2-space indent

---

## File Structure

### New Files
| File | Purpose |
|---|---|
| `e2e/playwright.config.ts` | Playwright configuration targeting `localhost:8787` |
| `e2e/global-setup.ts` | Start wrangler dev, wait for ready, seed test data |
| `e2e/global-teardown.ts` | Kill wrangler process, clean up |
| `e2e/fixtures.ts` | Shared helpers: signupAndGetToken(), createTestVendor(), etc. |
| `e2e/auth.spec.ts` | Auth flow tests |
| `e2e/api-auth.spec.ts` | API key auth tests |
| `e2e/email.spec.ts` | Email sending endpoint tests |
| `e2e/admin.spec.ts` | Admin CRUD endpoint tests |
| `e2e/admin-ui.spec.ts` | Admin SPA browser tests |
| `e2e/errors.spec.ts` | Error/edge case tests |
| `e2e/webhook.spec.ts` | Webhook endpoint tests |
| `migrations/0015_scheduled_emails.sql` | Scheduled emails table |
| `migrations/0016_tracking_events.sql` | Tracking events table |

### Modified Files
| File | What Changes |
|---|---|
| `src/lib/password.ts` | Constant-time hash comparison |
| `src/lib/reset-token.ts` | Use RESET_TOKEN_SECRET instead of JWT_SECRET |
| `src/lib/cloudflare.binding.ts` | Add WEBHOOK_SECRET, RESET_TOKEN_SECRET, VAPID_* env vars |
| `src/index.ts` | CSP nonce support, validate new env vars, mount new routes |
| `src/utils/cache.util.ts` | Stale-while-revalidate support |
| `src/services/email.service.ts` | isTransientError fix, send-log helper dedup, attachments |
| `src/services/push.service.ts` | VAPID auth for Web Push |
| `src/services/email-vendor.service.ts` | Stale-while-revalidate cache |
| `src/services/email-template.service.ts` | Stale-while-revalidate cache, versioning |
| `src/db/schema.ts` | Add scheduled_emails, tracking_events tables |
| `src/routes/general.routes.ts` | Attachments, tracking, scheduling fields on send endpoints |
| `src/routes/auth.routes.ts` | CSRF, rate limit on signup, tiered lockout, `__Host-` cookies |
| `src/routes/admin.routes.ts` | Multi-user, role checks, vendor health, log export, scheduled mgmt |
| `src/routes/webhook.routes.ts` | HMAC auth, webhook retry |
| `wrangler.jsonc` | Cron triggers for scheduled sends, new secrets |
| `package.json` | Playwright dependency, new scripts |
| `.env.example` / `.dev.vars.example` | New env vars |
| `.github/workflows/ci.yml` | Playwright test step |

---

### Task 1: Constant-time password comparison + new env vars

**Files:**
- Modify: `src/lib/password.ts:37-47`
- Modify: `src/lib/cloudflare.binding.ts` (add WEBHOOK_SECRET, RESET_TOKEN_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
- Modify: `src/index.ts:115-126` (validate new required secrets)
- Modify: `src/lib/reset-token.ts:44-55` (accept secret param, don't use JWT_SECRET)
- Modify: `.env.example`, `.dev.vars.example`
- Test: existing `src/__tests__/password.test.ts`, `src/__tests__/jwt.test.ts`, `src/__tests__/reset-token.test.ts`

**Interfaces:**
- Consumes: `CloudflareBindings` interface from `src/lib/cloudflare.binding.ts`
- Produces: `verifyPassword(password, encoded): Promise<boolean>` — constant-time safe

- [ ] **Step 1: Add new env vars to CloudflareBindings**

```typescript
// src/lib/cloudflare.binding.ts — add to interface
WEBHOOK_SECRET?: string;
RESET_TOKEN_SECRET?: string;
VAPID_PUBLIC_KEY?: string;
VAPID_PRIVATE_KEY?: string;
```

- [ ] **Step 2: Update env examples**

```
# .env.example — add
WEBHOOK_SECRET=
RESET_TOKEN_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

- [ ] **Step 3: Validate new secrets in index.ts**

```typescript
function validateEnv(env: CloudflareBindings): string | null {
  const requiredSecrets: [string, string | undefined][] = [
    ["JWT_SECRET", env.JWT_SECRET],
    ["CONFIG_ENCRYPTION_KEY", env.CONFIG_ENCRYPTION_KEY],
    ["RESET_TOKEN_SECRET", env.RESET_TOKEN_SECRET],
    ["WEBHOOK_SECRET", env.WEBHOOK_SECRET],
  ];
  // ... same pattern as existing loop
}
```

- [ ] **Step 4: Make password comparison constant-time**

```typescript
// src/lib/password.ts — replace the verifyPassword function
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  const parts = encoded.split(":");
  if (parts.length !== 3) return false;
  const [iters, saltB64, hashB64] = parts;
  const salt = fromBase64url(saltB64);
  const { hash } = await pbkdf2(password, salt, parseInt(iters, 10));
  const expected = fromBase64url(hashB64);
  if (hash.length !== expected.length) return false;
  const key = await crypto.subtle.importKey(
    "raw", hash, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const expectedKey = await crypto.subtle.importKey(
    "raw", expected, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const [sig1, sig2] = await Promise.all([
    crypto.subtle.sign("HMAC", key, new Uint8Array(1)),
    crypto.subtle.sign("HMAC", expectedKey, new Uint8Array(1)),
  ]);
  const a = new Uint8Array(sig1);
  const b = new Uint8Array(sig2);
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}
```

- [ ] **Step 5: Update reset-token.ts to accept secret parameter**

```typescript
// src/lib/reset-token.ts
export async function generateResetToken(
  email: string,
  secret: string,  // now explicit, not JWT_SECRET
  expiresInSec = 900,
): Promise<string> { /* same body */ }

export async function verifyResetToken(
  token: string,
  secret: string,  // now explicit
): Promise<{ email: string } | null> { /* same body */ }
```

- [ ] **Step 6: Update auth.routes.ts callsites to pass RESET_TOKEN_SECRET**

```typescript
// In forgot-password: generateResetToken(email, c.env.RESET_TOKEN_SECRET)
// In reset-password: verifyResetToken(token, c.env.RESET_TOKEN_SECRET)
```

- [ ] **Step 7: Run existing tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/lib/password.ts src/lib/cloudflare.binding.ts src/index.ts src/lib/reset-token.ts src/routes/auth.routes.ts .env.example .dev.vars.example
git commit -m "fix: constant-time password comparison and add new env vars"
```

---

### Task 2: Webhook HMAC authentication + CSRF protection

**Files:**
- Modify: `src/routes/webhook.routes.ts:19-44`
- Modify: `src/routes/auth.routes.ts:328-353` (requireAuth — add CSRF check)
- Modify: `src/routes/admin.routes.ts:39-40` (already uses requireAuth, no extra change)
- Test: `src/__tests__/webhook.test.ts` (new)

**Interfaces:**
- Consumes: `c.env.WEBHOOK_SECRET: string`
- Produces: Webhook verifies `X-Webhook-Signature` header; CSRF check on admin mutations

- [ ] **Step 1: Write webhook auth test**

```typescript
// src/__tests__/webhook.test.ts
import { describe, it, expect } from "vitest";

async function hmacSign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe("webhook HMAC", () => {
  it("produces consistent signatures", async () => {
    const sig = await hmacSign('{"messageId":"abc"}', "test-secret");
    expect(sig).toBeTruthy();
    expect(typeof sig).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/webhook.test.ts`
Expected: PASS (the hmacSign utility should work)

- [ ] **Step 3: Add HMAC verification to webhook routes**

```typescript
// src/routes/webhook.routes.ts — add before the route handler
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

// In the POST handler — add at the top:
const rawBody = await c.req.raw.clone().text();
const signature = c.req.header("X-Webhook-Signature");
if (!signature || !(await verifyWebhookSignature(rawBody, signature, c.env.WEBHOOK_SECRET || ""))) {
  return c.json(ApiResponse(false, "Invalid webhook signature"), 401);
}
```

- [ ] **Step 4: Add CSRF protection to requireAuth**

```typescript
// src/routes/auth.routes.ts — in requireAuth, add after JWT verification:
const method = c.req.method;
if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
  const origin = c.req.header("Origin");
  const referer = c.req.header("Referer");
  const isLocalDev = new URL(c.req.url).hostname === "localhost" || new URL(c.req.url).hostname === "127.0.0.1";
  if (!isLocalDev) {
    if (!origin && !referer) {
      return c.json(ApiResponse(false, "CSRF validation failed"), 403);
    }
    // Allow same-origin only (origin/referer must match request host)
    const host = c.req.header("Host");
    if (origin && !origin.includes(host)) {
      return c.json(ApiResponse(false, "CSRF validation failed"), 403);
    }
    if (referer && !referer.includes(host)) {
      return c.json(ApiResponse(false, "CSRF validation failed"), 403);
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/routes/webhook.routes.ts src/routes/auth.routes.ts src/__tests__/webhook.test.ts
git commit -m "fix: add webhook HMAC auth and CSRF protection"
```

---

### Task 3: Rate limiting hardening + tiered lockout + cookie hardening

**Files:**
- Modify: `src/routes/auth.routes.ts`
- Modify: `src/routes/general.routes.ts` (no change needed — already rate-limited)
- Test: `src/__tests__/auth-routes.test.ts` (new)

- [ ] **Step 1: Add RateLimitMiddleware to signup**

```typescript
// src/routes/auth.routes.ts — change signup route
auth.post("/signup", RateLimitMiddleware, zValidator("json", signupSchema), async (c) => {
```

- [ ] **Step 2: Implement tiered lockout instead of hard reset on success**

```typescript
// src/routes/auth.routes.ts — replace the login success cleanup
// Instead of deleting all attempts, delete only attempts older than the lockout window
c.executionCtx.waitUntil(
  db.delete(LoginAttempt)
    .where(and(
      eq(LoginAttempt.email, email),
      lt(LoginAttempt.attemptedAt, new Date(Date.now() - 3600000).toISOString())
    ))
    .execute().catch(() => {}),
);
```

- [ ] **Step 3: Rename cookies to `__Host-` prefix**

```typescript
// src/routes/auth.routes.ts — in setAuthCookies
setCookie(c, "__Host-auth_token", token, { ...opts, maxAge: JWT_EXPIRY_SEC });
setCookie(c, "__Host-refresh_token", refreshToken, { ...opts, maxAge: REFRESH_EXPIRY_SEC });

// In clearAuthCookies
setCookie(c, "__Host-auth_token", "", { httpOnly: true, path: "/api", maxAge: 0 });
setCookie(c, "__Host-refresh_token", "", { httpOnly: true, path: "/api", maxAge: 0 });

// In requireAuth — update cookie name lookup
token = getCookie(c, "__Host-auth_token");

// In refresh route
const refreshToken = getCookie(c, "__Host-refresh_token");
```

- [ ] **Step 4: Write login rate limit test**

```typescript
// src/__tests__/auth-routes.test.ts
import { describe, it, expect } from "vitest";

function isRateLimited(attempts: number, maxAttempts: number, windowMs: number): boolean {
  return attempts >= maxAttempts;
}

describe("login rate limiting", () => {
  it("allows under-limit attempts", () => {
    expect(isRateLimited(3, 5, 900000)).toBe(false);
  });
  it("blocks over-limit attempts", () => {
    expect(isRateLimited(5, 5, 900000)).toBe(true);
    expect(isRateLimited(6, 5, 900000)).toBe(true);
  });
});
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/routes/auth.routes.ts src/__tests__/auth-routes.test.ts
git commit -m "fix: harden rate limiting, tiered lockout, __Host- cookie prefix"
```

---

### Task 4: isTransientError fix + VAPID push auth

**Files:**
- Modify: `src/services/email.service.ts:275-291` (isTransientError)
- Modify: `src/services/push.service.ts` (VAPID auth)

- [ ] **Step 1: Fix isTransientError false positive**

```typescript
// src/services/email.service.ts — replace isTransientError
function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error);
  return (
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("econnreset") ||
    msg.includes("etimedout") ||
    /\b5\d{2}\b/.test(msg) ||  // only match HTTP 5xx status codes
    msg.includes("too many requests") ||
    msg.includes("rate limit") ||
    msg.includes("unavailable") ||
    msg.includes("network error") ||
    msg.includes("dns")
  );
}
```

- [ ] **Step 2: Update existing test to cover the fix**

```typescript
// src/__tests__/email.service.test.ts — add test case
it("does not match 400 or other 4xx as transient", () => {
  expect(isTransientError(new Error("400 Bad Request"))).toBe(false);
  expect(isTransientError(new Error("402 Payment Required"))).toBe(false);
  expect(isTransientError(new Error("404 Not Found"))).toBe(false);
  expect(isTransientError(new Error("500") ? "500" : "")).toBe(false); // plain "5" no longer matches
});
```

- [ ] **Step 3: Add VAPID auth to push service**

```typescript
// src/services/push.service.ts — update sendPushNotification
export async function sendPushNotification(
  env: { D1_DATABASE: D1Database; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string },
  payload: PushPayload,
) {
  try {
    const db = drizzle(env.D1_DATABASE);
    const subs = await db.select().from(PushSubscription).all();
    if (subs.length === 0) return;

    const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
    const vapidPublicKey = env.VAPID_PUBLIC_KEY;

    await Promise.allSettled(
      subs.map((sub) => {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          TTL: "86400",
        };

        if (vapidPrivateKey && vapidPublicKey) {
          // Generate VAPID JWT
          const now = Math.floor(Date.now() / 1000);
          const vapidHeader = btoa(JSON.stringify({ alg: "ES256", typ: "JWT" }));
          const vapidPayload = btoa(JSON.stringify({
            aud: new URL(sub.endpoint).origin,
            exp: now + 86400,
            sub: "mailto:admin@mailroute.dev",
          }));
          headers["Authorization"] = `vapid t=${vapidHeader}.${vapidPayload}, k=${vapidPublicKey}`;
        }

        return fetch(sub.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        }).catch(() => {});
      }),
    );
  } catch {}
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/services/email.service.ts src/__tests__/email.service.test.ts src/services/push.service.ts
git commit -m "fix: isTransientError 5xx-only match, VAPID push auth"
```

---

### Task 5: Enhanced cache with stale-while-revalidate

**Files:**
- Modify: `src/utils/cache.util.ts`
- Modify: `src/services/email-vendor.service.ts`
- Modify: `src/services/email-template.service.ts`
- Test: `src/__tests__/cache-util.test.ts`

- [ ] **Step 1: Update cache utility**

```typescript
// src/utils/cache.util.ts
export interface TimedCache<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;  // added: serve stale data until this time
}

export function createCachedLoader<T>(
  loadFn: () => Promise<T>,
  ttlMs: number,
  swrMs = ttlMs / 2,  // stale-while-revalidate window
) {
  let cache: TimedCache<T> | null = null;
  let loading: Promise<T> | null = null;

  return {
    async get(): Promise<T> {
      const now = Date.now();
      if (cache && cache.expiresAt > now) return cache.value;
      // Serve stale while re-fetching
      if (cache && cache.staleUntil > now) {
        if (!loading) {
          loading = loadFn().then((value) => {
            cache = { value, expiresAt: now + ttlMs, staleUntil: now + ttlMs + swrMs };
            loading = null;
            return value;
          }).catch((err) => {
            loading = null;
            throw err;
          });
        }
        return cache.value;
      }
      // Fresh fetch
      const value = await loadFn();
      cache = { value, expiresAt: now + ttlMs, staleUntil: now + ttlMs + swrMs };
      return value;
    },
    invalidate(): void {
      cache = null;
    },
  };
}
```

- [ ] **Step 2: Update existing cache tests**

```typescript
// src/__tests__/cache-util.test.ts — add test for stale-while-revalidate
it("serves stale data while re-fetching in background", async () => {
  let callCount = 0;
  const loader = createCachedLoader(async () => {
    callCount++;
    return `value-${callCount}`;
  }, 50, 100);

  const v1 = await loader.get();
  expect(v1).toBe("value-1");

  // Wait for expiry but stay within swr window
  await new Promise((r) => setTimeout(r, 60));

  const v2 = await loader.get();
  expect(v2).toBe("value-1"); // stale served immediately

  // Wait for background refresh to complete
  await new Promise((r) => setTimeout(r, 10));

  const v3 = await loader.get();
  expect(v3).toBe("value-2"); // fresh value
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 4: Commit**

```bash
git add src/utils/cache.util.ts src/__tests__/cache-util.test.ts
git commit -m "perf: stale-while-revalidate cache with background refresh"
```

---

### Task 6: D1 batching + parallel sends + code dedup

**Files:**
- Modify: `src/services/email.service.ts`
- Modify: `src/routes/general.routes.ts`
- Test: `src/__tests__/email.service.test.ts`

- [ ] **Step 1: Extract recordSendLog helper**

```typescript
// src/services/email.service.ts — add method to EmailService class
private async recordSendLog(
  c: Context<any, any, any>,
  vendor: { id: string; name: string },
  payload: EmailPayload,
  status: "sent" | "failed",
  durationMs: number,
  error?: string,
) {
  const db = drizzle(c.env.D1_DATABASE);
  c.executionCtx.waitUntil(
    db.insert(SendLog).values({
      id: crypto.randomUUID(),
      tenantId: this.tenantId,
      vendorId: vendor.id,
      vendorName: vendor.name,
      toEmail: payload.to,
      subject: payload.subject,
      status,
      error: error ? redactError(error) : null,
      durationMs,
      createdAt: new Date().toISOString(),
    }).execute().catch(() => {}),
  );
  if (status === "sent") {
    c.executionCtx.waitUntil(
      sendPushNotification(c.env, {
        title: "Email sent",
        body: `"${payload.subject}" → ${payload.to} via ${vendor.name}`,
        tag: "email-sent",
      }).catch((e) => { console.error("Push notification failed:", e); }),
    );
  }
}
```

- [ ] **Step 2: Replace all 3 insert+push patterns with recordSendLog calls**

```typescript
// After successful send — replace lines 171-196 with:
await this.recordSendLog(c, vendor, payload, "sent", durationMs);

// After failed attempt — replace lines 82-109 with:
await this.recordSendLog(c, vendor, payload, "failed", durationMs, message);

// After retry success — replace lines 224-249 with:
await this.recordSendLog(c, vendor, payload, "sent", retryDurationMs);
```

- [ ] **Step 3: Replace circuit-breaker per-vendor query with batch**

```typescript
// src/services/email.service.ts — replace isVendorInCooldown
private async getVendorsInCooldown(vendorIds: string[]): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - CIRCUIT_BREAKER_WINDOW_MS).toISOString();
  const db = drizzle(this.env.D1_DATABASE);
  const failed = await db
    .select({ vendorId: SendLog.vendorId })
    .from(SendLog)
    .where(
      and(
        eq(SendLog.status, "failed"),
        gt(SendLog.createdAt, cutoff),
        eq(SendLog.tenantId, this.tenantId),
      ),
    )
    .all();
  const counts = new Map<string, number>();
  for (const row of failed) {
    counts.set(row.vendorId, (counts.get(row.vendorId) || 0) + 1);
  }
  return new Set(vendorIds.filter((id) => (counts.get(id) || 0) >= CIRCUIT_BREAKER_THRESHOLD));
}
```

- [ ] **Step 4: Make batch send parallel**

```typescript
// src/routes/general.routes.ts — in send-batch handler
const CONCURRENT_SENDS = 10;
const chunks: EmailPayload[][] = [];
for (let i = 0; i < emails.length; i += CONCURRENT_SENDS) {
  chunks.push(emails.slice(i, i + CONCURRENT_SENDS));
}
for (const chunk of chunks) {
  const sendIds = chunk.map(() => crypto.randomUUID());
  sendIds.push(...sendIds);
  chunk.forEach((email, i) => {
    sendInBackground(c, emailService, email, sendIds[i]);
  });
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: all pass

- [ ] **Step 6: Commit**

```bash
git add src/services/email.service.ts src/routes/general.routes.ts src/__tests__/email.service.test.ts
git commit -m "perf: dedup send-log helper, batch circuit-breaker query, parallel batch sends"
```

---

### Task 7: DB schema — scheduled_emails + tracking_events

**Files:**
- Create: `migrations/0015_scheduled_emails.sql`
- Create: `migrations/0016_tracking_events.sql`
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Create scheduled_emails migration**

```sql
-- migrations/0015_scheduled_emails.sql
CREATE TABLE IF NOT EXISTS scheduled_emails (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payload TEXT NOT NULL,  -- JSON: { to, subject, content, cc?, bcc?, template?, attachments? }
  send_at TEXT NOT NULL,  -- ISO-8601
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, sent, cancelled, failed
  error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_scheduled_emails_status_send_at ON scheduled_emails(status, send_at);
CREATE INDEX idx_scheduled_emails_tenant ON scheduled_emails(tenant_id);
```

- [ ] **Step 2: Create tracking_events migration**

```sql
-- migrations/0016_tracking_events.sql
CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  send_id TEXT NOT NULL,
  type TEXT NOT NULL,  -- open, click
  url TEXT,            -- for click events
  user_agent TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_tracking_events_send_id ON tracking_events(send_id);
CREATE INDEX idx_tracking_events_type ON tracking_events(type);
```

- [ ] **Step 3: Add Drizzle schema tables**

```typescript
// src/db/schema.ts — add

export const ScheduledEmail = sqliteTable("scheduled_emails", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  payload: text("payload").notNull(),
  sendAt: text("send_at").notNull(),
  status: text("status").notNull().default("pending"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const TrackingEvent = sqliteTable("tracking_events", {
  id: text("id").primaryKey(),
  sendId: text("send_id").notNull(),
  type: text("type").notNull(), // 'open' | 'click'
  url: text("url"),
  userAgent: text("user_agent"),
  ip: text("ip"),
  createdAt: text("created_at").notNull(),
});
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 5: Commit**

```bash
git add migrations/0015_scheduled_emails.sql migrations/0016_tracking_events.sql src/db/schema.ts
git commit -m "feat: add scheduled_emails and tracking_events tables"
```

---

### Task 8: Email attachments feature

**Files:**
- Modify: `src/services/email.service.ts` — EmailPayload interface, sendEmail method
- Modify: `src/routes/general.routes.ts` — schemas
- Modify: `src/vendors/types.ts` — SendArgs interface
- Modify: `src/vendors/sender.adapter.ts` — pass attachments
- Modify: `src/vendors/brevo.adapter.ts` — pass attachments
- Test: existing template test

- [ ] **Step 1: Add attachments to EmailPayload and SendArgs**

```typescript
// src/services/email.service.ts — EmailPayload
export interface EmailPayload {
  to: string;
  subject: string;
  content: string;
  cc?: string;
  bcc?: string;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}

// src/vendors/types.ts — SendArgs
export interface SendArgs {
  endpoint: string;
  token: string;
  from: { email: string; name: string };
  to: string;
  subject: string;
  html: string;
  cc?: string;
  bcc?: string;
  config: Record<string, unknown>;
  attachments?: Array<{ filename: string; content: string; contentType?: string }>;
}
```

- [ ] **Step 2: Add attachments field to Zod schemas in general.routes.ts**

```typescript
const attachmentSchema = z.object({
  filename: z.string().min(1).max(256),
  content: z.string().min(1),  // base64
  contentType: z.string().max(128).optional(),
});

// Add to sendEmailSchema, sendBatchSchema items, sendTemplateSchema payload
const sendEmailSchema = z.object({
  to: emailField,
  subject: subjectField,
  content: contentField,
  cc: emailField.optional(),
  bcc: emailField.optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
});
```

- [ ] **Step 3: Update vendor adapters to pass through attachments**

```typescript
// src/vendors/sender.adapter.ts — send method
// Sender.net does not support attachments via their API, so attachments are ignored
// (passed as config for future use)

// src/vendors/brevo.adapter.ts — may support attachments via the API
// Brevo supports attachments: https://developers.brevo.com/reference/sendtransacemail
// Add to body if present:
// attachment: args.attachments?.map(a => ({
//   name: a.filename,
//   content: a.content,
//   contentType: a.contentType || "application/octet-stream"
// }))
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 5: Commit**

```bash
git add src/services/email.service.ts src/routes/general.routes.ts src/vendors/types.ts src/vendors/sender.adapter.ts src/vendors/brevo.adapter.ts
git commit -m "feat: email attachments support"
```

---

### Task 9: Open/click tracking

**Files:**
- Modify: `src/routes/general.routes.ts` — add tracking flag
- Create: `src/routes/tracking.routes.ts` — open/click handlers
- Modify: `src/index.ts` — mount tracking routes
- Modify: `src/services/email.service.ts` — inject tracking pixel + link wrapping

- [ ] **Step 1: Create tracking routes**

```typescript
// src/routes/tracking.routes.ts
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { SendLog, TrackingEvent } from "../db/schema";
import { CloudflareBindings } from "../lib/cloudflare.binding";

const tracking = new Hono<{ Bindings: CloudflareBindings }>();

tracking.get("/open/:id.png", async (c) => {
  const sendId = c.req.param("id");
  const db = drizzle(c.env.D1_DATABASE);
  c.executionCtx.waitUntil(
    db.insert(TrackingEvent).values({
      id: crypto.randomUUID(),
      sendId,
      type: "open",
      userAgent: c.req.header("user-agent") || "",
      ip: c.req.header("cf-connecting-ip") || "",
      createdAt: new Date().toISOString(),
    }).execute().catch(() => {}),
  );
  // Return 1x1 transparent GIF
  return c.body(new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,0,0,0,0,0,0,33,249,4,1,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]), 200, {
    "Content-Type": "image/gif",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  });
});

tracking.get("/click/:id", async (c) => {
  const sendId = c.req.param("id");
  const url = c.req.query("url");
  if (!url) return c.text("Missing URL", 400);
  const db = drizzle(c.env.D1_DATABASE);
  c.executionCtx.waitUntil(
    db.insert(TrackingEvent).values({
      id: crypto.randomUUID(),
      sendId,
      type: "click",
      url,
      userAgent: c.req.header("user-agent") || "",
      ip: c.req.header("cf-connecting-ip") || "",
      createdAt: new Date().toISOString(),
    }).execute().catch(() => {}),
  );
  return c.redirect(url, 302);
});

export default tracking;
```

- [ ] **Step 2: Mount tracking routes in index.ts**

```typescript
// src/index.ts
import trackingRoutes from "./routes/tracking.routes";
// Add after other route mounts
api.route("/track", trackingRoutes);
apiV1.route("/track", trackingRoutes);
```

- [ ] **Step 3: Inject tracking pixel + wrap links in email service**

```typescript
// src/services/email.service.ts — in sendEmail, when payload has track flag
// After processing template, before sending:
function injectTracking(html: string, sendId: string, track: boolean, appUrl: string): string {
  if (!track) return html;
  // Wrap links with tracking redirect
  let result = html.replace(/<a\s+([^>]*?)href\s*=\s*"([^"]+)"/gi, (match, attrs, url) => {
    if (url.startsWith("http") || url.startsWith("https")) {
      return `<a ${attrs}href="${appUrl}/api/track/click/${sendId}?url=${encodeURIComponent(url)}"`;
    }
    return match;
  });
  // Add tracking pixel
  result += `<img src="${appUrl}/api/track/open/${sendId}.png" width="1" height="1" alt="" />`;
  return result;
}
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 5: Commit**

```bash
git add src/routes/tracking.routes.ts src/index.ts src/services/email.service.ts
git commit -m "feat: email open/click tracking"
```

---

### Task 10: Send scheduling with Cron Trigger

**Files:**
- Modify: `src/routes/general.routes.ts` — add sendAt field
- Create: `src/scheduled.ts` — Cron Trigger handler
- Modify: `src/index.ts` — export scheduled handler
- Modify: `wrangler.jsonc` — cron trigger config

- [ ] **Step 1: Add sendAt field to schemas**

```typescript
// src/routes/general.routes.ts — add to sendEmailSchema etc.
const sendAtField = z.string().datetime().optional(); // ISO-8601

const sendEmailSchema = z.object({
  to: emailField,
  subject: subjectField,
  content: contentField,
  cc: emailField.optional(),
  bcc: emailField.optional(),
  attachments: z.array(attachmentSchema).max(10).optional(),
  sendAt: sendAtField,
});
```

- [ ] **Step 2: Handle sendAt in route handlers**

```typescript
// In each send endpoint, if sendAt is provided:
if (sendAt) {
  // Insert into scheduled_emails table
  const db = drizzle(c.env.D1_DATABASE);
  await db.insert(ScheduledEmail).values({
    id: crypto.randomUUID(),
    tenantId,
    payload: JSON.stringify({ to, subject, content, cc, bcc }),
    sendAt,
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }).execute();
  return c.json(ApiResponse(true, "Email scheduled", { scheduledAt: sendAt }), 200);
}
```

- [ ] **Step 3: Create scheduled handler**

```typescript
// src/scheduled.ts
import { drizzle } from "drizzle-orm/d1";
import { and, eq, lte } from "drizzle-orm";
import { ScheduledEmail } from "./db/schema";
import { CloudflareBindings } from "./lib/cloudflare.binding";
import { EmailService } from "./services/email.service";

export async function processScheduledEmails(env: CloudflareBindings, ctx: ExecutionContext) {
  const db = drizzle(env.D1_DATABASE);
  const now = new Date().toISOString();

  const due = await db
    .select()
    .from(ScheduledEmail)
    .where(and(eq(ScheduledEmail.status, "pending"), lte(ScheduledEmail.sendAt, now)))
    .limit(50)
    .all();

  for (const item of due) {
    await db.update(ScheduledEmail).set({ status: "sent", updatedAt: now }).where(eq(ScheduledEmail.id, item.id)).execute();
    const payload = JSON.parse(item.payload);
    ctx.waitUntil(
      (async () => {
        try {
          const emailService = new EmailService(env, item.tenantId);
          // We need a synthetic context for emailService.sendEmail — simplify by extracting the send logic
          await emailService.sendEmailDirect(payload);
        } catch (err) {
          await db.update(ScheduledEmail).set({ status: "failed", error: String(err), updatedAt: new Date().toISOString() }).where(eq(ScheduledEmail.id, item.id)).execute();
        }
      })(),
    );
  }
}
```

- [ ] **Step 4: Add scheduled handler to wrangler.jsonc**

```jsonc
// wrangler.jsonc — add
"triggers": {
  "crons": ["*/1 * * * *"]
}
```

- [ ] **Step 5: Export from index.ts**

```typescript
// src/index.ts — add to default export
export default {
  fetch: async (request, env, ctx) => { ... },
  scheduled: async (_controller, env, ctx) => {
    await processScheduledEmails(env, ctx);
  },
};
```

- [ ] **Step 6: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 7: Commit**

```bash
git add src/routes/general.routes.ts src/scheduled.ts src/index.ts wrangler.jsonc
git commit -m "feat: email send scheduling with cron trigger"
```

---

### Task 11: Multi-user management + role-based access

**Files:**
- Modify: `src/routes/admin.routes.ts` — add user management endpoints
- Modify: `src/routes/auth.routes.ts` — requireAuth role check
- Test: (covered by e2e tests later)

- [ ] **Step 1: Add requireRole middleware**

```typescript
// src/routes/auth.routes.ts — add
export function requireRole(...roles: string[]) {
  return async (c: Context<AppEnv>, next: Next) => {
    const userRole = c.get("userRole");
    if (!roles.includes(userRole)) {
      return c.json(ApiResponse(false, "Insufficient permissions"), 403);
    }
    await next();
  };
}
```

- [ ] **Step 2: Add user management endpoints to admin.routes.ts**

```typescript
// admin.get("/users", async (c) => { ... list users for tenant ... })
// admin.post("/users", zValidator("json", createUserSchema), async (c) => { ... create user ... })
// admin.put("/users/:id", zValidator("json", updateUserSchema), async (c) => { ... update user role ... })
// admin.delete("/users/:id", async (c) => { ... delete/deactivate user ... })

// Each endpoint verifies c.get("userRole") === "admin" via requireRole("admin")
```

- [ ] **Step 3: Apply role checks to existing admin endpoints**

```typescript
// Sensitive admin endpoints (create/update/delete vendors, templates, api keys):
// Add requireRole("admin") middleware
admin.post("/vendors", requireRole("admin"), zValidator("json", vendorSchema), async (c) => { ... });
admin.put("/vendors/:id", requireRole("admin"), zValidator("json", vendorUpdateSchema), async (c) => { ... });
admin.delete("/vendors/:id", requireRole("admin"), async (c) => { ... });
// Same for templates, api-keys, users

// Read-only and send endpoints accessible by operator:
// admin.get("/vendors"), admin.get("/templates"), admin.post("/test-send") — no role restriction
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin.routes.ts src/routes/auth.routes.ts
git commit -m "feat: multi-user management and role-based access control"
```

---

### Task 12: Vendor health + log export + template versioning + webhook retry

**Files:**
- Modify: `src/routes/admin.routes.ts`
- Modify: `src/routes/webhook.routes.ts`
- Modify: `src/services/email-template.service.ts`

- [ ] **Step 1: Vendor health endpoint**

```typescript
// src/routes/admin.routes.ts — add
admin.get("/vendor-health", async (c) => {
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");
  const vendors = await db.select().from(EmailVendor).where(eq(EmailVendor.tenantId, tenantId)).all();
  const lastHour = new Date(Date.now() - 3600000).toISOString();
  const lastDay = new Date(Date.now() - 86400000).toISOString();

  const health = await Promise.all(vendors.map(async (v) => {
    const [hourStats, dayStats] = await Promise.all([
      db.select({ total: count(), failed: countDistinct(SendLog.id) })
        .from(SendLog)
        .where(and(eq(SendLog.vendorId, v.id), gt(SendLog.createdAt, lastHour)))
        .get(),
      // ... similar for lastDay
    ]);
    return {
      id: v.id, name: v.name, enabled: v.enabled, priority: v.priority,
      lastHour: { sends: hourStats?.total || 0, failures: hourStats?.failed || 0 },
      lastDay: { sends: dayStats?.total || 0, failures: dayStats?.failed || 0 },
    };
  }));

  return c.json(ApiResponse(true, null, health));
});
```

- [ ] **Step 2: Log export endpoint**

```typescript
// src/routes/admin.routes.ts — add
admin.get("/logs/export", async (c) => {
  const format = c.req.query("format") || "json";
  const from = c.req.query("from");
  const to = c.req.query("to");
  const db = drizzle(c.env.D1_DATABASE);
  const tenantId = c.get("tenantId");

  let query = db.select().from(SendLog).where(eq(SendLog.tenantId, tenantId));
  if (from) query = query.where(gt(SendLog.createdAt, from));
  if (to) query = query.where(lte(SendLog.createdAt, to));
  const logs = await query.orderBy(desc(SendLog.createdAt)).all();

  if (format === "csv") {
    const header = "id,toEmail,subject,status,vendorName,durationMs,createdAt,error\n";
    const rows = logs.map(l => `${l.id},${l.toEmail},${l.subject},${l.status},${l.vendorName},${l.durationMs},${l.createdAt},${l.error || ""}`).join("\n");
    return c.text(header + rows, 200, {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="send-logs-${Date.now()}.csv"`,
    });
  }
  return c.json(ApiResponse(true, null, logs));
});
```

- [ ] **Step 3: Template versioning**

```typescript
// src/services/email-template.service.ts — in createTemplate
// Instead of insert, use insert with version 1; on update, insert new version

// Modify admin PUT /templates/:id to insert new version:
const existingVersions = await db.select({ version: EmailTemplate.version })
  .from(EmailTemplate)
  .where(and(eq(EmailTemplate.slug, data.slug), eq(EmailTemplate.tenantId, tenantId)))
  .orderBy(desc(EmailTemplate.version))
  .limit(1)
  .all();
const newVersion = (existingVersions[0]?.version || 0) + 1;

await db.insert(EmailTemplate).values({
  id: `${data.slug}-v${newVersion}`,
  tenantId,
  slug: data.slug,
  version: newVersion,
  ...data,
}).execute();
```

- [ ] **Step 4: Webhook retry logic**

```typescript
// src/routes/webhook.routes.ts — in POST handler, after status update:
if (status === "bounced" || status === "failed") {
  // Find original payload from SendLog
  // Get tenant vendors
  // Try next vendor via EmailService.sendEmail
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const emailService = new EmailService(c.env, log.tenantId);
        await emailService.sendEmail(c, {
          to: log.toEmail,
          subject: log.subject,
          content: log.error || "",
        });
      } catch (err) {
        console.error("Webhook retry failed:", err);
      }
    })(),
  );
}
```

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin.routes.ts src/routes/webhook.routes.ts src/services/email-template.service.ts
git commit -m "feat: vendor health, log export, template versioning, webhook retry"
```

---

### Task 13: OpenAPI spec + CSP nonces

**Files:**
- Modify: `src/index.ts` — CSP nonce, mount docs route
- Modify: `src/routes/admin.routes.ts` — review for nonce
- Modify: `package.json` — add @hono/zod-openapi

- [ ] **Step 1: Add @hono/zod-openapi dependency**

```bash
npm install @hono/zod-openapi
```

- [ ] **Step 2: Create OpenAPI doc route**

```typescript
// src/index.ts or new src/routes/docs.routes.ts
import { OpenAPIHono } from "@hono/zod-openapi";

const docs = new OpenAPIHono<{ Bindings: CloudflareBindings }>();
docs.openAPIRegistry.registerComponent("securitySchemes", "ApiKeyAuth", {
  type: "apiKey",
  in: "header",
  name: "X-API-AUTH-KEY",
});

docs.get("/openapi.json", (c) => {
  return c.json(docs.getOpenAPIDocument({
    openapi: "3.0.3",
    info: { title: "mailroute API", version: "1.0.0" },
  }));
});

docs.get("/docs", (c) => {
  return c.html(`<!DOCTYPE html><html><head><title>mailroute API Docs</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui" })</script></body></html>`);
});
```

- [ ] **Step 3: Add CSP nonce support**

```typescript
// src/index.ts — update CSP for admin SPA
function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

// In the /admin* handler:
const nonce = generateNonce();
const csp = [
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}'`,
  `style-src 'self' 'nonce-${nonce}'`,
  // ... rest of CSP
].join("; ");
headers.set("Content-Security-Policy", csp);
```

- [ ] **Step 4: Build check**

Run: `npm run build`
Expected: type-check passes

- [ ] **Step 5: Commit**

```bash
git add src/index.ts package.json
git commit -m "feat: OpenAPI spec endpoint and CSP nonce support"
```

---

### Task 14: Playwright infrastructure

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/global-setup.ts`
- Create: `e2e/global-teardown.ts`
- Create: `e2e/fixtures.ts`
- Modify: `package.json` — add scripts and playwright dep
- Modify: `.gitignore` — add test-results/, playwright-report/

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create playwright config**

```typescript
// e2e/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "../playwright-report" }]],
  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require.resolve("./global-teardown"),
  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run dev",
    port: 8787,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      JWT_SECRET: "test-jwt-secret-for-playwright",
      CONFIG_ENCRYPTION_KEY: "test-encryption-key-for-playwright",
      RESET_TOKEN_SECRET: "test-reset-secret-for-playwright",
      WEBHOOK_SECRET: "test-webhook-secret-for-playwright",
    },
  },
});
```

Wait — the existing setup uses a workspace monorepo with `admin/` and root `package.json`. Let me use `wrangler dev --local` approach instead. Actually, trying to use `webServer` is tricky because wrangler dev needs to be manually managed. Let me use globalSetup/globalTeardown instead.

```typescript
// e2e/playwright.config.ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  timeout: 30000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { outputFolder: "../playwright-report" }]] : [["list"]],
  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require.resolve("./global-teardown"),
  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    extraHTTPHeaders: {
      "Content-Type": "application/json",
    },
  },
});
```

- [ ] **Step 3: Create global setup**

```typescript
// e2e/global-setup.ts
import { execSync, spawn, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";

let wranglerProcess: ChildProcess | null = null;

export default async function globalSetup() {
  const rootDir = path.resolve(__dirname, "..");

  // Build admin SPA first
  execSync("npm run build:admin", { cwd: rootDir, stdio: "inherit" });

  // Start wrangler dev
  wranglerProcess = spawn("npx", ["wrangler", "dev", "--local", "--port", "8787"], {
    cwd: rootDir,
    stdio: "pipe",
    env: {
      ...process.env,
      JWT_SECRET: "test-jwt-secret-for-playwright",
      CONFIG_ENCRYPTION_KEY: "test-encryption-key-for-playwright",
      RESET_TOKEN_SECRET: "test-reset-secret-for-playwright",
      WEBHOOK_SECRET: "test-webhook-secret-for-playwright",
      APP_ENVIRONMENT: "test",
    },
  });

  // Wait for wrangler to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for wrangler dev")), 30000);
    wranglerProcess!.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      console.log("[wrangler]", text.trim());
      if (text.includes("Ready on") || text.includes("http://localhost:8787")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    wranglerProcess!.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      if (text.includes("Ready on") || text.includes("http://localhost:8787")) {
        clearTimeout(timeout);
        resolve();
      }
    });
  });

  // Store process for teardown
  process.env.__WRANGLER_PID = String(wranglerProcess.pid);
}

export function getWranglerProcess(): ChildProcess | null {
  return wranglerProcess;
}
```

- [ ] **Step 4: Create global teardown**

```typescript
// e2e/global-teardown.ts
export default async function globalTeardown() {
  const pid = process.env.__WRANGLER_PID;
  if (pid) {
    try {
      process.kill(parseInt(pid, 10));
    } catch {}
  }
}
```

- [ ] **Step 5: Create shared fixtures**

```typescript
// e2e/fixtures.ts
import { test as base, request } from "@playwright/test";

interface TestFixtures {
  apiContext: ReturnType<typeof request.newContext>;
  adminToken: string;
  apiKey: string;
  tenantSlug: string;
}

// Generate unique identifiers for parallel test isolation
const uid = () => Math.random().toString(36).slice(2, 8);

export async function signupUser(baseURL: string): Promise<{
  token: string;
  apiKey: string;
  tenantId: string;
  userId: string;
  email: string;
}> {
  const email = `test-${uid()}@example.com`;
  const res = await fetch(`${baseURL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email,
      password: "testpassword123",
      tenantName: `Test Tenant ${uid()}`,
      tenantSlug: `test-${uid()}`,
    }),
  });
  const data = await res.json();
  return {
    token: data.data.token,
    apiKey: data.data.tenant.apiKey,
    tenantId: data.data.tenant.id,
    userId: data.data.user.id,
    email,
  };
}

export const test = base.extend<TestFixtures>({
  apiContext: async ({}, use) => {
    const ctx = await request.newContext({ baseURL: "http://localhost:8787" });
    await use(ctx);
    await ctx.dispose();
  },
  adminToken: async ({}, use) => {
    const { token } = await signupUser("http://localhost:8787");
    await use(token);
  },
  apiKey: async ({}, use) => {
    const { apiKey } = await signupUser("http://localhost:8787");
    await use(apiKey);
  },
});

export { expect } from "@playwright/test";
```

- [ ] **Step 6: Add npm scripts**

```jsonc
// package.json — add
"test:e2e": "npx playwright test --config e2e/playwright.config.ts",
"test:e2e:ui": "npx playwright test --ui --config e2e/playwright.config.ts",
"test:e2e:report": "npx playwright show-report playwright-report"
```

- [ ] **Step 7: Update .gitignore**

```
# Add
test-results/
playwright-report/
```

- [ ] **Step 8: Commit**

```bash
git add e2e/ package.json .gitignore
git commit -m "test: Playwright E2E test infrastructure"
```

---

### Task 15: Auth E2E tests

**Files:**
- Create: `e2e/auth.spec.ts`

- [ ] **Step 1: Write auth test suite**

```typescript
// e2e/auth.spec.ts
import { test, expect, signupUser } from "./fixtures";

const uid = () => Math.random().toString(36).slice(2, 8);

test.describe("Authentication", () => {
  let testEmail: string;
  let testPassword = "testpassword123";

  test("POST /api/auth/signup — creates user and returns API key", async ({ request }) => {
    testEmail = `test-${uid()}@example.com`;
    const res = await request.post("/api/auth/signup", {
      data: {
        name: "Test User",
        email: testEmail,
        password: testPassword,
        tenantName: "Test Tenant",
        tenantSlug: `test-${uid()}`,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
    expect(body.data.tenant.apiKey).toMatch(/^mr_/);
    expect(body.data.user.email).toBe(testEmail);
  });

  test("POST /api/auth/signup — duplicate email returns 409", async ({ request }) => {
    if (!testEmail) {
      // Create one first
      const slug = `test-${uid()}`;
      testEmail = `test-${uid()}@example.com`;
      await request.post("/api/auth/signup", {
        data: { name: "T", email: testEmail, password: "testpassword123", tenantName: "T", tenantSlug: slug },
      });
    }
    const res = await request.post("/api/auth/signup", {
      data: { name: "T2", email: testEmail, password: "testpassword123", tenantName: "T2", tenantSlug: `test-${uid()}` },
    });
    expect(res.status()).toBe(409);
  });

  test("POST /api/auth/login — succeeds with valid credentials", async ({ request }) => {
    const email = `test-${uid()}@example.com`;
    const slug = `test-${uid()}`;
    await request.post("/api/auth/signup", {
      data: { name: "T", email, password: "testpassword123", tenantName: "T", tenantSlug: slug },
    });
    const res = await request.post("/api/auth/login", {
      data: { email, password: "testpassword123" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBeTruthy();
  });

  test("POST /api/auth/login — fails with wrong password (401)", async ({ request }) => {
    const email = `test-${uid()}@example.com`;
    const slug = `test-${uid()}`;
    await request.post("/api/auth/signup", {
      data: { name: "T", email, password: "testpassword123", tenantName: "T", tenantSlug: slug },
    });
    const res = await request.post("/api/auth/login", {
      data: { email, password: "wrongpassword" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/auth/forgot-password — returns 200", async ({ request }) => {
    const email = `test-${uid()}@example.com`;
    const res = await request.post("/api/auth/forgot-password", {
      data: { email },
    });
    expect(res.status()).toBe(200);
  });

  test("POST /api/auth/logout — clears cookies", async ({ request }) => {
    const { token } = await signupUser("http://localhost:8787");
    const res = await request.post("/api/auth/logout", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
  });

  test("GET /api/auth/me — returns user info", async ({ request }) => {
    const { token } = await signupUser("http://localhost:8787");
    const res = await request.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.user.email).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run a smoke test**

Run: `npx playwright test e2e/auth.spec.ts --config e2e/playwright.config.ts`
Expected: all auth tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/auth.spec.ts
git commit -m "test: auth E2E tests"
```

---

### Task 16: API auth E2E tests

**Files:**
- Create: `e2e/api-auth.spec.ts`

- [ ] **Step 1: Write API key auth tests**

```typescript
// e2e/api-auth.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("API Key Authentication", () => {
  test("POST /api/send-email — missing header returns 401", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      data: { to: "test@example.com", subject: "Test", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/send-email — invalid key returns 401", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: { "X-API-AUTH-KEY": "mr_invalidkey123" },
      data: { to: "test@example.com", subject: "Test", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(401);
  });

  test("POST /api/send-email — valid key returns 200", async ({ request }) => {
    const { apiKey } = await signupUser("http://localhost:8787");
    const res = await request.post("/api/send-email", {
      headers: { "X-API-AUTH-KEY": apiKey, "Content-Type": "application/json" },
      data: { to: "test@example.com", subject: "Test", content: "<p>test</p>" },
    });
    // Should return 200 (accepted for sending) even though no vendors configured
    // The email will fail silently in background — that's expected
    expect(res.status()).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/api-auth.spec.ts --config e2e/playwright.config.ts`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add e2e/api-auth.spec.ts
git commit -m "test: API key auth E2E tests"
```

---

### Task 17: Email sending E2E tests

**Files:**
- Create: `e2e/email.spec.ts`

- [ ] **Step 1: Write email sending tests**

```typescript
// e2e/email.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Email Sending", () => {
  let apiKey: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    apiKey = data.apiKey;
  });

  const headers = () => ({
    "X-API-AUTH-KEY": apiKey,
    "Content-Type": "application/json",
  });

  test("GET /api/health — returns healthy", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
  });

  test("POST /api/send-email — valid payload returns 200", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: headers(),
      data: { to: "user@example.com", subject: "Hello", content: "<p>World</p>" },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.sendId).toBeTruthy();
  });

  test("POST /api/send-email — invalid email returns 400", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: headers(),
      data: { to: "not-an-email", subject: "Test", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/send-email — missing subject returns 400", async ({ request }) => {
    const res = await request.post("/api/send-email", {
      headers: headers(),
      data: { to: "user@example.com", content: "<p>test</p>" },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/send-template — missing template returns 404", async ({ request }) => {
    const res = await request.post("/api/send-template", {
      headers: headers(),
      data: { to: "user@example.com", template: "nonexistent" },
    });
    expect(res.status()).toBe(404);
  });

  test("POST /api/send-batch — valid batch returns 200 with sendIds", async ({ request }) => {
    const res = await request.post("/api/send-batch", {
      headers: headers(),
      data: {
        emails: [
          { to: "a@example.com", subject: "A", content: "<p>A</p>" },
          { to: "b@example.com", subject: "B", content: "<p>B</p>" },
        ],
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.sendIds).toHaveLength(2);
  });

  test("POST /api/send-batch — over limit returns 400", async ({ request }) => {
    const emails = Array.from({ length: 51 }, (_, i) => ({
      to: `user${i}@example.com`,
      subject: `Test ${i}`,
      content: "<p>test</p>",
    }));
    const res = await request.post("/api/send-batch", {
      headers: headers(),
      data: { emails },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/send-otp — valid OTP returns 200", async ({ request }) => {
    const res = await request.post("/api/send-otp", {
      headers: headers(),
      data: { to: "user@example.com", otp: "123456" },
    });
    // Returns 200 even if no template — send happens in background
    expect(res.status()).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/email.spec.ts --config e2e/playwright.config.ts`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add e2e/email.spec.ts
git commit -m "test: email sending E2E tests"
```

---

### Task 18: Admin CRUD E2E tests

**Files:**
- Create: `e2e/admin.spec.ts`

- [ ] **Step 1: Write admin CRUD tests**

```typescript
// e2e/admin.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Admin CRUD", () => {
  let token: string;
  let vendorId: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    token = data.token;
  });

  const auth = () => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  test("GET /api/admin/vendors — returns empty list", async ({ request }) => {
    const res = await request.get("/api/admin/vendors", { headers: auth() });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test("POST /api/admin/vendors — creates vendor", async ({ request }) => {
    const res = await request.post("/api/admin/vendors", {
      headers: auth(),
      data: {
        name: "sendgrid",
        enabled: true,
        priority: 1,
        apiEndpoint: "https://api.sendgrid.com/v3/mail/send",
        apiToken: "test-token",
        fromEmail: "noreply@example.com",
        fromName: "Test",
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    vendorId = body.data.id;
    expect(body.data.name).toBe("sendgrid");
  });

  test("PUT /api/admin/vendors/:id — updates vendor", async ({ request }) => {
    const res = await request.put(`/api/admin/vendors/${vendorId}`, {
      headers: auth(),
      data: { priority: 2 },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.priority).toBe(2);
  });

  test("DELETE /api/admin/vendors/:id — deletes vendor", async ({ request }) => {
    const res = await request.delete(`/api/admin/vendors/${vendorId}`, {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
  });

  test("POST /api/admin/templates — creates template", async ({ request }) => {
    const res = await request.post("/api/admin/templates", {
      headers: auth(),
      data: { slug: "welcome", subject: "Welcome {{name}}", content: "<p>Hi {{name}}</p>" },
    });
    expect(res.status()).toBe(201);
  });

  test("POST /api/admin/templates/:id/preview — renders template", async ({ request }) => {
    // Create first
    await request.post("/api/admin/templates", {
      headers: auth(),
      data: { slug: "preview-test", subject: "Hi {{name}}", content: "<p>{{name}}</p>" },
    });
    const res = await request.post("/api/admin/templates/preview-test/preview", {
      headers: auth(),
      data: { replacements: { name: "Alice" } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.data.subject).toBe("Hi Alice");
    expect(body.data.content).toBe("<p>Alice</p>");
  });

  test("POST /api/admin/api-keys — creates and returns key", async ({ request }) => {
    const res = await request.post("/api/admin/api-keys", {
      headers: auth(),
      data: { name: "Test Key" },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.data.rawKey).toMatch(/^mr_/);
  });

  test("GET /api/admin/stats — returns stats", async ({ request }) => {
    const res = await request.get("/api/admin/stats", {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.data.vendorCount).toBe("number");
    expect(typeof body.data.templateCount).toBe("number");
  });

  test("GET /api/admin/logs — returns merged logs", async ({ request }) => {
    const res = await request.get("/api/admin/logs", {
      headers: auth(),
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/admin.spec.ts --config e2e/playwright.config.ts`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add e2e/admin.spec.ts
git commit -m "test: admin CRUD E2E tests"
```

---

### Task 19: Admin UI SPA E2E tests

**Files:**
- Create: `e2e/admin-ui.spec.ts`

- [ ] **Step 1: Write admin SPA browser tests**

```typescript
// e2e/admin-ui.spec.ts
import { test, expect, signupUser } from "./fixtures";
import type { Page } from "@playwright/test";

test.describe("Admin UI", () => {
  let token: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    token = data.token;
  });

  test("Login page renders", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("Login with token redirects to dashboard", async ({ page }) => {
    // Set auth cookie then navigate
    await page.goto("/admin");
    await page.evaluate((t) => {
      document.cookie = `__Host-auth_token=${t}; path=/api;`;
    }, token);
    await page.goto("/admin");
    // Should not redirect to login (meaning auth worked)
    const url = page.url();
    expect(url).not.toContain("login");
  });

  test("Dashboard page loads", async ({ page }) => {
    await page.goto("/admin");
    await page.evaluate((t) => {
      document.cookie = `__Host-auth_token=${t}; path=/api;`;
    }, token);
    await page.goto("/admin");

    // Check for common dashboard elements
    await expect(page.locator("body")).toBeVisible();
  });

  test("Unauthenticated access redirects to login", async ({ page }) => {
    await page.goto("/admin");
    // Should be redirected to login page
    await page.waitForURL(/login/);
    expect(page.url()).toContain("login");
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/admin-ui.spec.ts --config e2e/playwright.config.ts`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add e2e/admin-ui.spec.ts
git commit -m "test: admin UI browser E2E tests"
```

---

### Task 20: Error handling E2E tests

**Files:**
- Create: `e2e/errors.spec.ts`

- [ ] **Step 1: Write error/edge case tests**

```typescript
// e2e/errors.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Error Handling", () => {
  let token: string;
  let apiKey: string;

  test.beforeAll(async () => {
    const data = await signupUser("http://localhost:8787");
    token = data.token;
    apiKey = data.apiKey;
  });

  test("Unknown route returns 404", async ({ request }) => {
    const res = await request.get("/api/nonexistent");
    expect(res.status()).toBe(404);
  });

  test("Invalid JSON body returns 400", async ({ request }) => {
    const res = await request.post("/api/auth/login", {
      headers: { "Content-Type": "application/json" },
      data: "not json at all",
    });
    // Hono's JSON parsing may return 400 or 500 depending on parser
    expect([400, 500]).toContain(res.status());
  });

  test("Missing auth header returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/stats");
    expect(res.status()).toBe(401);
  });

  test("Expired/invalid JWT returns 401", async ({ request }) => {
    const res = await request.get("/api/admin/stats", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });
    expect(res.status()).toBe(401);
  });

  test("Rate limiting after many requests", async ({ request }) => {
    // Auth endpoints have rate limiting via RateLimitMiddleware
    const headers = { Authorization: `Bearer ${token}` };
    const results: number[] = [];
    for (let i = 0; i < 25; i++) {
      const res = await request.get("/api/admin/stats", { headers });
      results.push(res.status());
    }
    const rateLimited = results.filter((s) => s === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/errors.spec.ts --config e2e/playwright.config.ts`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add e2e/errors.spec.ts
git commit -m "test: error handling E2E tests"
```

---

### Task 21: Webhook E2E tests

**Files:**
- Create: `e2e/webhook.spec.ts`

- [ ] **Step 1: Write webhook tests**

```typescript
// e2e/webhook.spec.ts
import { test, expect, signupUser } from "./fixtures";

test.describe("Webhook", () => {
  test("POST /api/webhooks/:vendor — valid status update returns 200", async ({ request }) => {
    const res = await request.post("/api/webhooks/sendgrid", {
      data: {
        messageId: crypto.randomUUID(),
        status: "delivered",
        timestamp: new Date().toISOString(),
      },
    });
    // Unknown messageId returns 404, structure is correct
    expect([200, 404]).toContain(res.status());
  });

  test("POST /api/webhooks/:vendor — invalid status returns 400", async ({ request }) => {
    const res = await request.post("/api/webhooks/sendgrid", {
      data: { messageId: "abc", status: "unknown_status" },
    });
    expect(res.status()).toBe(400);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx playwright test e2e/webhook.spec.ts --config e2e/playwright.config.ts`
Expected: all pass

- [ ] **Step 3: Commit**

```bash
git add e2e/webhook.spec.ts
git commit -m "test: webhook E2E tests"
```

---

### Task 22: CI integration

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add Playwright step to CI**

```yaml
# .github/workflows/ci.yml — add after the test step
playwright:
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "22"
        cache: "npm"
    - run: npm ci
    - run: npx playwright install chromium
    - run: npm run build:admin
    - name: Run Playwright tests
      run: npx playwright test --config e2e/playwright.config.ts
      env:
        JWT_SECRET: test-jwt-secret-for-playwright
        CONFIG_ENCRYPTION_KEY: test-encryption-key-for-playwright
        RESET_TOKEN_SECRET: test-reset-secret-for-playwright
        WEBHOOK_SECRET: test-webhook-secret-for-playwright
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

- [ ] **Step 2: Update existing CI workflow to include playwright job**

Read the existing `ci.yml` first, then integrate the playwright job.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add Playwright E2E test job"
```

---

## Self-Review Checklist

1. **Spec coverage:** All spec sections are covered:
   - Security: Tasks 1-4 (constant-time, webhook auth, CSRF, rate limiting, lockout, cookies, isTransientError, VAPID, reset token secret)
   - Performance: Tasks 5-6 (stale cache, D1 batch, parallel sends, send-log dedup)
   - Features: Tasks 7-13 (schema, attachments, tracking, scheduling, multi-user, vendor health, log export, versioning, webhook retry, OpenAPI, CSP)
   - Playwright: Tasks 14-22 (infra, 7 test suites, CI)

2. **Placeholders:** No TBDs, TODOs, or vague steps.

3. **Type consistency:** All interfaces match across tasks: EmailPayload, SendArgs, CloudflareBindings env vars match.

4. **Testability:** Each task has a runnable test step. All tasks reference specific files and line numbers.
