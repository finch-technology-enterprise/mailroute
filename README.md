# mailroute

A Cloudflare Worker ([Hono](https://hono.dev)) that exposes a small HTTP API for sending transactional emails through a **configurable, multi-vendor failover chain**. Vendors (Sender.net, Brevo, and any future provider) are configured in a D1 table — switching, reordering, enabling/disabling, or rotating tokens requires **no redeploy**.

## How it works

1. A request hits a route (`/send-email` or `/send-otp`), authenticated via the `X-API-AUTH-KEY` header and rate-limited.
2. The route fires `EmailService.sendEmail` inside `waitUntil(...)`, so the HTTP response returns immediately while the send runs in the background.
3. `EmailService` loads the **enabled vendors ordered by `priority`** from the `email_vendors` D1 table (cached 60s) and tries each in turn via its adapter, **failing over** to the next vendor on error. It throws only if every vendor fails.

## Endpoints

All responses use the `ApiResponse(success, message, data?)` envelope.

| Method | Path                       | Auth             | Body                                       | Notes                                                                                                                                                                                                                                            |
| ------ | -------------------------- | ---------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/email/api/health`        | none             | —                                          | Liveness; empty `200`.                                                                                                                                                                                                                           |
| `POST` | `/email/api/send-email`    | `X-API-AUTH-KEY` | `{ to, subject, content }`                 | Sends `content` directly as HTML.                                                                                                                                                                                                                |
| `POST` | `/email/api/send-otp`      | `X-API-AUTH-KEY` | `{ to, otp }`                              | Renders the `otp-verification` D1 template with `{ code: otp }`. `404` if the template is missing.                                                                                                                                               |
| `POST` | `/email/api/send-template` | `X-API-AUTH-KEY` | `{ to, template, subject?, replacements }` | Renders the named D1 template (by `slug`), substituting `{{key}}` tokens in subject and content from `replacements` (optional, defaults to `{}`). Optional `subject` overrides the template's default subject. `404` if the template is missing. |

Invalid bodies return `400`; payloads over 50KB return `413`.

**Input validation (all routes, via Zod):** `to` is a valid email (≤254 chars); `subject` is ≤255 chars with CR/LF stripped (header-injection defense); `content` is ≤50 000 chars; `otp` is 1–12 alphanumeric chars; `template` is a `^[a-z0-9-]+$` slug (≤128); `replacements` keys are `^[a-zA-Z0-9_]+$` (≤64, max 50 keys) and values ≤50 000 chars. Template substitution is literal (split/join, not RegExp), so user-supplied keys/values cannot inject regex or replacement patterns. Replacement **values are emitted as raw HTML by design** — only pass trusted content.

## Development

```sh
cp .env.example .dev.vars     # create your local env file
# Edit .dev.vars with your real credentials
npm install
npm run dev                   # local Worker via Wrangler
npm run build                 # type-check only (tsc --noEmit) — the project's verification gate
npm run format                # Prettier
```

There is no test runner configured; `npm run build` is the correctness gate.

## Deployment

```sh
npm run deploy                # deploy Worker to Cloudflare
npm run deploy-secret         # push secrets from .env to Cloudflare
```

Alternatively, push secrets individually:

```sh
wrangler secret put API_AUTH_KEY
```

Pass `CloudflareBindings` as generics when instantiating Hono:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>();
```

Bindings are hand-maintained in `src/lib/cloudflare.binding.ts` (the source of truth for `env` typing). Run `npm run cf-typegen` after editing `wrangler.jsonc`.

## Configuration

### Required environment variables

| Variable                 | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `API_AUTH_KEY`           | Secret shared with callers; sent as `X-API-AUTH-KEY` header                 |
| `NEW_RELIC_LICENSE_KEY`  | New Relic license key for observability logging                             |
| `NEW_RELIC_LOG_ENDPOINT` | New Relic Log API endpoint (default: `https://log-api.newrelic.com/log/v1`) |
| `APP_ENVIRONMENT`        | `production`, `staging`, or `development`                                   |
| `APP_URL`                | Public URL of the application                                               |
| `TIMEZONE`               | Timezone for date formatting (default: `Asia/Kuala_Lumpur`)                 |

### Bindings & secrets

- `D1_DATABASE` — D1 SQLite database (`email_templates` and `email_vendors` tables).
- `RATE_LIMITER` — Cloudflare Rate Limiting binding (20 requests per 60 seconds per IP+route).
- Secrets in `env`: `API_AUTH_KEY`, `NEW_RELIC_LICENSE_KEY`, `NEW_RELIC_LOG_ENDPOINT`, `APP_ENVIRONMENT`, `APP_URL`, `TIMEZONE`. (The legacy `SENDER_API_ENDPOINT` / `SENDER_API_TOKEN` are deprecated — vendor credentials now live in the `email_vendors` table.)

Shared config is resolved at runtime from the central `service_config` D1 table via `ConfigService` (60s cache), with env-binding fallback.

### Email vendors (`email_vendors` D1 table)

One row per vendor. The `name` column maps to a code adapter in `src/vendors/`.

| column                       | purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `name`                       | adapter key — `sender`, `brevo` (must match a registered adapter) |
| `enabled`                    | include/exclude this vendor from the chain                        |
| `priority`                   | lower value is tried first                                        |
| `api_endpoint` / `api_token` | vendor credentials                                                |
| `from_email` / `from_name`   | per-vendor sender identity                                        |
| `config`                     | optional JSON for vendor-specific extras                          |

Seed/migrate the table with the checked-in script (fill in the `REPLACE_WITH_*` placeholders first):

```sh
wrangler d1 execute <DB_NAME> --local  --file scripts/seed-email-vendors.sql
wrangler d1 execute <DB_NAME> --remote --file scripts/seed-email-vendors.sql
```

Edits to `email_vendors` take effect within the 60s cache TTL — no redeploy.

## Observability

Logs are shipped to New Relic via the `NewRelicLogging` helper. The following request metadata is sent:

- `context.ip` — the caller's Cloudflare edge IP (`cf-connecting-ip`)
- `context.host`, `context.url`, `context.method`
- `context.colo`, `context.country`, `context.region` — Cloudflare edge location

Sensitive headers (`authorization`, `x-api-auth-key`, `cookie`) and body fields (`otp`, `password`, `token`, `secret`) are redacted as `[REDACTED]` before logging. Email HTML content is truncated to 256 characters.

## Adding things

**A new email type:** insert a template row in D1 with a unique `slug`, then add a route that calls `EmailTemplateService.getProcessedTemplate(slug, replacements)` and fires `sendEmail` inside `waitUntil`.

**A new email vendor:**

1. Create `src/vendors/<name>.adapter.ts` exporting an `EmailVendorAdapter` whose `name` matches the D1 row, implementing that vendor's auth header and request body in `send()`.
2. Register it in `src/vendors/index.ts` (`ADAPTERS`).
3. Insert an `email_vendors` row with that `name`, plus `priority`, `enabled`, `api_endpoint`, `api_token`, `from_email`, `from_name`.

Only shipping a brand-new adapter (steps 1–2) needs a redeploy; enabling, reordering, or re-crediting an existing vendor does not.

## Project layout

```
src/
  index.ts                      Worker entry; global middleware
  routes/general.routes.ts      health, send-email, send-otp, send-template
  services/
    email.service.ts            failover send loop
    email-vendor.service.ts     reads enabled vendors (priority-ordered, cached)
    email-template.service.ts   D1 template lookup + {{key}} substitution
    config.service.ts           central service_config resolver
  vendors/
    types.ts                    EmailVendorAdapter / SendArgs
    sender.adapter.ts           Sender.net
    brevo.adapter.ts            Brevo
    index.ts                    ADAPTERS registry
  middlewares/                  logger, error handler, auth, rate limit
  db/schema.ts                  Drizzle schema (EmailTemplate, EmailVendor, ServiceConfig)
  lib/cloudflare.binding.ts     hand-maintained env typing
scripts/seed-email-vendors.sql  table DDL + seed rows
```

## Admin UI

An admin interface is bundled at `/email/admin/*`. It allows managing email vendors and templates, and sending test emails.

### Development

```sh
# Terminal 1: Worker
npm run dev

# Terminal 2: Admin SPA
cd admin && npm run dev    # Vite on :5173, proxies /email/api to :8787
```

### Production build

```sh
npm run build:admin        # build the SPA to admin/dist/
npm run deploy             # deploy Worker + SPA
```

The SPA is served by the Worker via the `ADMIN_ASSETS` binding. The first time you visit the admin UI, you'll be prompted for the `API_AUTH_KEY` — it is stored in `localStorage` and sent as the `X-API-AUTH-KEY` header.

## License

MIT
