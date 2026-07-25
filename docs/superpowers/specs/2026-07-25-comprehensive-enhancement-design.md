# mailroute Comprehensive Enhancement Design

**Date:** 2026-07-25
**Project:** finchtech-email-microservice (mailroute)
**Approach:** Big Bang — all changes delivered as one coordinated branch

## 1. Security Hardening

### 1.1 Critical

| Issue | File | Fix |
|---|---|---|
| Password comparison not constant-time | `src/lib/password.ts:46` | Use `crypto.subtle.timingSafeEqual` with `Uint8Array` for hash comparison instead of string `===` |
| Webhook endpoint has zero auth | `src/routes/webhook.routes.ts` | Add `WEBHOOK_SECRET` env var; require `X-Webhook-Signature: HMAC-SHA256(body, secret)` header |
| CSRF protection missing | Cookie-based auth | Add `Origin`/`Referer` validation on state-changing admin routes; verify `csrf-token` header on mutations |

### 1.2 High

| Issue | File | Fix |
|---|---|---|
| `isTransientError("5")` false positive | `src/services/email.service.ts:282` | Replace `msg.includes("5")` with `/\b5\d{2}\b/.test(msg)` |
| Push notifications lack VAPID auth | `src/services/push.service.ts` | Add `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` env vars; implement Web Push VAPID protocol |
| Reset token reuses JWT_SECRET | `src/lib/reset-token.ts` | Add `RESET_TOKEN_SECRET` env var, separate from JWT_SECRET |

### 1.3 Medium

| Issue | File | Fix |
|---|---|---|
| Signup has no rate limit | `src/routes/auth.routes.ts` | Apply `RateLimitMiddleware` to `/auth/signup` |
| CSP `'unsafe-inline'` on admin SPA | `src/index.ts:72-84` | Generate per-request CSP nonce for `<style>` tags |
| No `__Host-` prefix on auth cookies | `src/routes/auth.routes.ts:24-33` | Rename cookies to `__Host-auth_token`, `__Host-refresh_token` |
| Login lockout resets on success | `src/routes/auth.routes.ts:169-171` | Implement tiered lockout: 3→1min, 5→15min, 7→1hr |

### 1.4 Env Vars Added

- `WEBHOOK_SECRET` (required) — HMAC key for webhook payload verification
- `RESET_TOKEN_SECRET` (required) — separate key from JWT_SECRET for reset tokens
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (optional) — Web Push protocol auth

## 2. Performance Optimization

### 2.1 Database

| Change | Description |
|---|---|
| Batch circuit-breaker queries | Replace per-vendor `COUNT` in `isVendorInCooldown` with single query across all vendor IDs |
| Stale-while-revalidate cache | Upgrade `createCachedLoader` to return stale data + background refresh (stale-while-revalidate=30s, max-age=60s) |
| D1 batch API | Wrap sequential inserts (send_log + activity_log) into `db.batch([...])` |

### 2.2 Code

| Change | Description |
|---|---|
| Parallel batch sends | Replace sequential `for` loop in `/send-batch` with `Promise.allSettled` (capped at 10) |
| Deduplicate send-log pattern | Extract `recordSendLog(c, vendor, payload, status, durationMs)` helper (used in 3 places) |
| Merge-log UNION query | Replace in-memory merge sort with single `UNION` SQL query |

### 2.3 Infrastructure

- Move `RESET_TOKEN_SECRET` and `WEBHOOK_SECRET` to `wrangler secret put` (not `.dev.vars` for prod)

## 3. Feature Enhancements

### 3.1 Email Capabilities

#### Attachments
- New field: `attachments?: Array<{ filename: string, content: string, contentType?: string }>`
- On `send-email`, `send-template`, `send-batch`
- `content` is base64-decoded before passing to vendor adapter
- Vendors that don't support attachments receive only the HTML body

#### Open/Click Tracking
- New field: `track?: boolean`
- When enabled:
  - Injects `<img src="/api/track/open/{sendId}.png" width=1 height=1>` at end of HTML
  - Wraps `<a href="...">` → `<a href="/api/track/click/{sendId}?url=...">`
- New table: `tracking_events (id, sendId, type [open|click], url?, timestamp)`
- New routes: `GET /track/open/:id.png` (204), `GET /track/click/:id` (302 redirect)

#### Send Scheduling
- New field: `sendAt?: string (ISO-8601)`
- New table: `scheduled_emails (id, tenantId, payload JSON, sendAt, status [pending/sent/cancelled], createdAt)`
- New Cron Trigger: `*/1 * * * *` polls due emails and dispatches via existing `EmailService`
- New routes: `GET /admin/scheduled`, `DELETE /admin/scheduled/:id`

### 3.2 Admin & Operations

#### Vendor Health Dashboard
- New endpoint: `GET /admin/vendor-health`
- Returns per vendor: success rate (1h/24h), avg latency, circuit breaker status, total sends
- Front-end: new dashboard tiles with sparklines

#### Webhook Retry
- When webhook receives `bounced`/`complained`/`failed`:
  - Look up the original send payload from send_logs
  - Attempt next vendor in priority order using existing `EmailService`

#### Template Versioning
- Add `version: integer` to `email_templates` (composite unique: slug + version)
- `PUT /templates/:id` inserts new row with incremented version instead of update
- `GET /templates/:id/versions` lists all versions
- `GET /templates/:id?version=N` retrieves specific version

### 3.3 Management

#### Multi-User per Tenant
- New table: no change needed (User already has tenantId + role)
- New routes: `GET/POST/PUT/DELETE /admin/users`
- Roles: `admin` (full access), `operator` (can send/view logs, cannot manage vendors/templates/api keys)
- `requireAuth` middleware enforces role checks on sensitive endpoints

#### Log Export
- New endpoint: `GET /admin/logs/export?format=csv|json&from=ISO&to=ISO`
- Streams paginated send_logs as downloadable file
- CSV: first row is header; JSON: array of objects

### 3.4 Developer Experience

#### OpenAPI Spec
- Add `@hono/zod-openapi` to annotate routes
- Serve spec at `GET /api/openapi.json`
- Serve Swagger UI at `GET /api/docs`

#### Health Check Improvements
- `GET /health` now also returns: vendor count, per-vendor status, git commit SHA (from `CF_PAGES_COMMIT_SHA` or env)

## 4. Playwright E2E Tests

### 4.1 Infrastructure

- Add `@playwright/test` as root devDependency
- Create `e2e/` directory with:
  - `playwright.config.ts` — targets `http://localhost:8787` (wrangler dev)
  - `global-setup.ts` — starts `wrangler dev`, waits for 200 on `/api/health`, seeds test data
  - `global-teardown.ts` — kills wrangler process, cleans up D1 test DB
  - `fixtures.ts` — shared test helpers (signup helper, auth header builder, test vendor data)
- Update `.github/workflows/ci.yml` — add Playwright step
- Update `.gitignore` for `test-results/`, `playwright-report/`

### 4.2 Test Suites

#### `e2e/auth.spec.ts`
- Signup → 201, cookies, API key returned
- Signup duplicate email → 409
- Signup duplicate tenant slug → 409
- Login → 200, cookies
- Login wrong password → 401, attempt counted in LoginAttempt
- Login 6th attempt → 429
- Forgot password → 200
- Reset password → 200, new creds work
- Refresh token → new JWT
- Logout → cookies cleared
- Get /me → 200 with user + tenant
- Verify email → 200

#### `e2e/api-auth.spec.ts`
- No `X-API-AUTH-KEY` → 401
- Valid key → 200
- Revoked key → 401
- Malformed key → 401

#### `e2e/email.spec.ts`
- Health check → 200, `healthy`
- `POST /send-email` valid → 200, sendId
- `POST /send-email` invalid email → 400
- `POST /send-email` missing subject → 400
- `POST /send-email` body > 50KB → 413
- `POST /send-template` valid → 200
- `POST /send-template` missing slug → 404
- `POST /send-batch` 3 emails → 200, 3 sendIds
- `POST /send-batch` 51 emails → 400
- `POST /send-batch` 0 emails → 400
- `POST /send-otp` valid → 200
- `POST /send-otp` invalid OTP → 400

#### `e2e/admin.spec.ts`
- List vendors → 200 (empty)
- Create vendor → 201
- Create duplicate name → error
- Update vendor → 200
- Delete vendor → 200
- Delete nonexistent → 404
- Create template → 201
- Preview template → 200
- Update template → 200
- Delete template → 200
- Create API key → 201, raw key returned
- List API keys → 200
- Revoke API key → 200
- Revoke already revoked → error
- Get stats → 200
- Get logs → 200

#### `e2e/admin-ui.spec.ts`
- Login page renders (title, form fields, button)
- Successful login → redirected to dashboard
- Dashboard loads with stats
- Navigate to Vendors → page renders
- Navigate to Templates → page renders
- Navigate to Logs → page renders
- Logout → redirected to login

#### `e2e/errors.spec.ts`
- Rate limit after 21 requests to same endpoint
- Invalid JSON → 400
- Unknown route → 404
- Missing auth → 401
- Expired JWT → 401

#### `e2e/webhook.spec.ts`
- Valid status update → 200
- Unknown messageId → 404

### 4.3 CI Integration

```yaml
# Addition to .github/workflows/ci.yml
playwright:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "22" }
    - run: npm ci
    - run: npx playwright install chromium
    - run: npm run build:admin
    - run: npx playwright test
      env:
        JWT_SECRET: test-jwt-secret
        CONFIG_ENCRYPTION_KEY: test-encryption-key
```

## 5. Files Changed

### New Files
- `e2e/playwright.config.ts`
- `e2e/global-setup.ts`
- `e2e/global-teardown.ts`
- `e2e/fixtures.ts`
- `e2e/auth.spec.ts`
- `e2e/api-auth.spec.ts`
- `e2e/email.spec.ts`
- `e2e/admin.spec.ts`
- `e2e/admin-ui.spec.ts`
- `e2e/errors.spec.ts`
- `e2e/webhook.spec.ts`
- `migrations/0015_scheduled_emails.sql`
- `migrations/0016_tracking_events.sql`

### Modified Files
- `src/lib/password.ts` — constant-time comparison
- `src/services/email.service.ts` — isTransientError fix, send-log helper, attachments support
- `src/services/push.service.ts` — VAPID auth
- `src/services/email-vendor.service.ts` — stale-while-revalidate cache
- `src/services/email-template.service.ts` — stale-while-revalidate cache, versioning
- `src/utils/cache.util.ts` — enhanced with background refresh
- `src/routes/general.routes.ts` — attachments, tracking, scheduling fields
- `src/routes/admin.routes.ts` — multi-user, role checks, vendor health, log export, scheduled emails
- `src/routes/webhook.routes.ts` — HMAC auth, retry logic
- `src/routes/auth.routes.ts` — CSRF, rate limit on signup, tiered lockout, `__Host-` cookies
- `src/middlewares/api-auth-key.middleware.ts` — no changes needed
- `src/index.ts` — CSP nonces, new routes (tracking, docs), validate new env vars
- `src/db/schema.ts` — new tables
- `src/lib/reset-token.ts` — separate RESET_TOKEN_SECRET
- `src/lib/cloudflare.binding.ts` — new env vars
- `wrangler.jsonc` — cron triggers, new secrets
- `package.json` — playwright dependency, new scripts
- `.env.example` / `.dev.vars.example` — new env vars
- `.github/workflows/ci.yml` — playwright step

## 6. Implementation Order

1. **Security fixes** (all files in §1) — foundation, no new features depend on them
2. **Performance fixes** (§2) — mostly mechanical, low risk
3. **Env var changes** — add to `cloudflare.binding.ts`, `wrangler.jsonc`, `.env.example`
4. **DB schema** — new migrations for scheduled_emails + tracking_events
5. **Feature code** (§3) — in this order: attachments → tracking → scheduling → vendor health → webhook retry → template versioning → multi-user → log export → OpenAPI spec
6. **Playwright infrastructure** — config, setup, teardown, fixtures
7. **Test suites** — auth → api-auth → email → admin → admin-ui → errors → webhook
8. **CI integration** — add to GitHub Actions
