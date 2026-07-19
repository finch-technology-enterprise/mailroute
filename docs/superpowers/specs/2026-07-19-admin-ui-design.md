# Admin UI — Design Spec

## Overview

A React-based admin interface bundled into the mailroute Worker. Served at `/email/admin/*` for managing email vendors, templates, and sending test emails.

## Architecture

### Monorepo layout

```
admin/
  src/
    main.tsx            Entry point
    App.tsx             Router + layout shell
    pages/
      Dashboard.tsx     Overview with stats
      Vendors.tsx       Vendor list + CRUD
      VendorForm.tsx    Add/edit vendor form (modal)
      Templates.tsx     Template list + CRUD
      TemplateForm.tsx  Add/edit template form (modal)
      TestSend.tsx      Send test email form
    components/
      Layout.tsx        Sidebar + topbar shell
      Table.tsx         Reusable sortable table
      StatusBadge.tsx   Enabled/disabled pill
      EmptyState.tsx    Placeholder for empty lists
      ConfirmDialog.tsx Delete confirmation modal
    api/
      client.ts         fetch wrapper, sets X-API-AUTH-KEY, handles errors
      vendors.ts        Vendor CRUD calls
      templates.ts      Template CRUD calls
      admin.ts          Test-send, dashboard stats
    types.ts            Shared TypeScript types
  index.html
  vite.config.ts
  package.json          Separate deps, build outputs to admin/dist/
  tsconfig.json

src/
  routes/
    admin.routes.ts     New Hono routes for admin CRUD + test-send
  index.ts              Updated to register admin routes + serve SPA at /email/admin/*
```

### SPA serving

The SPA is built with Vite (`base: "/email/admin/"`) and outputs to `admin/dist/`. In `wrangler.jsonc`, the `assets` config makes the build directory available as a binding:

```json
"assets": {
  "directory": "admin/dist",
  "binding": "ADMIN_ASSETS"
}
```

A catch-all Worker route serves the SPA:

```ts
app.get("/email/admin/:path*", async (c) => {
  const path = c.req.param("path") || "index.html";
  const res = await c.env.ADMIN_ASSETS.fetch(new Request(`https://fake/${path}`));
  if (res.status === 200) return res;
  return c.env.ADMIN_ASSETS.fetch(new Request("https://fake/index.html"));
});
```

The Worker's route patterns include both API and admin paths:
```json
"routes": [
  { "pattern": "mailroute.example.com/email/api/*" },
  { "pattern": "mailroute.example.com/email/admin/*" }
]
```

## Backend API

All admin endpoints under `/email/api/admin`, reuse existing `ApiAuthKeyMiddleware`.

### Vendors

| Method | Path                                | Body                                              | Response              |
|--------|-------------------------------------|---------------------------------------------------|-----------------------|
| GET    | `/email/api/admin/vendors`          | —                                                 | `{ data: Vendor[] }`  |
| POST   | `/email/api/admin/vendors`          | `{ name, enabled, priority, api_endpoint, api_token, from_email, from_name, config? }` | `{ data: Vendor }`    |
| PUT    | `/email/api/admin/vendors/:id`      | Partial vendor fields                             | `{ data: Vendor }`    |
| DELETE | `/email/api/admin/vendors/:id`      | —                                                 | `{ success: true }`   |

### Templates

| Method | Path                                | Body                                              | Response              |
|--------|-------------------------------------|---------------------------------------------------|-----------------------|
| GET    | `/email/api/admin/templates`        | —                                                 | `{ data: Template[] }`|
| POST   | `/email/api/admin/templates`        | `{ slug, subject, content }`                      | `{ data: Template }`  |
| PUT    | `/email/api/admin/templates/:id`    | Partial template fields                           | `{ data: Template }`  |
| DELETE | `/email/api/admin/templates/:id`    | —                                                 | `{ success: true }`   |

### Test send

| Method | Path                                | Body                                              | Response                    |
|--------|-------------------------------------|---------------------------------------------------|-----------------------------|
| POST   | `/email/api/admin/test-send`        | `{ to, subject, content }`                        | `{ success, vendor?, error? }` |

Runs `EmailService.sendEmail` **synchronously** (no `waitUntil`) and returns which vendor handled it, or the failover error.

### Stats

| Method | Path                                | Response              |
|--------|-------------------------------------|-----------------------|
| GET    | `/email/api/admin/stats`            | `{ vendorCount, templateCount }` |

## Frontend

### Stack

- React 19 + TypeScript
- Vite for build
- Tailwind CSS v4 for styling
- React Router v7 for client-side routing (basename: `/email/admin/`)
- No component library — custom components with Tailwind

### Pages

**Dashboard** — `/`
- Summary cards: vendor count, template count
- Quick links to Vendors and Templates

**Vendors** — `/vendors`
- Table: name, enabled (toggle pill), priority, from_email, actions (edit/delete)
- "Add Vendor" button opens VendorForm modal
- Edit opens VendorForm modal pre-filled
- Delete shows ConfirmDialog then removes row
- Enabled toggle calls PUT immediately

**VendorForm** — modal
- Fields: name (required), enabled (checkbox), priority (number, 1-999), api_endpoint (url, required), api_token (password, required), from_email (email, required), from_name (text), config (JSON textarea, optional)
- Client-side validation before submit
- Submit button with loading spinner

**Templates** — `/templates`
- Table: slug, subject preview, actions (edit/delete)
- "Add Template" button opens TemplateForm modal

**TemplateForm** — modal
- Fields: slug (regex `^[a-z0-9-]+$`, required), subject (text, required), content (textarea — HTML, required)
- Slug helper hint
- Subject and content support `{{key}}` placeholders

**Test Send** — `/test-send`
- Form: to (email, required), subject (text, required), content (textarea — HTML, required)
- "Send" button with loading state
- Response section: success/failure, which vendor handled it, error details
- Quick "Send test to yourself" shortcut

### Auth

Admin UI prompts for `API_AUTH_KEY` on first visit, stores in `localStorage`. Every API call passes it as `X-API-AUTH-KEY`. A settings gear icon opens a dialog to re-enter the key.

### States

- **Loading:** Skeleton rows during fetch
- **Empty:** "No vendors configured. Add your first vendor." with CTA button
- **Error:** Toast "Failed to load vendors. Check your API key."
- **Validation:** Inline per-field error messages

## Build & deploy

### Development

```sh
# Terminal 1: Worker
npm run dev

# Terminal 2: SPA
cd admin && npm install && npm run dev    # Vite on :5173, proxies /email/api to :8787
```

### Production

```sh
cd admin && npm run build     # outputs to admin/dist/
cd .. && npm run deploy       # wrangler deploy
```

Root `package.json` gets scripts:
```json
"scripts": {
  "dev:admin": "cd admin && npm run dev",
  "build:admin": "cd admin && npm run build",
  "deploy": "npm run build:admin && wrangler deploy --minify"
}
```

## Files to create/modify

### New files (24)
- `admin/package.json`, `admin/tsconfig.json`, `admin/vite.config.ts`, `admin/index.html`
- `admin/src/main.tsx`, `admin/src/App.tsx`, `admin/src/types.ts`
- `admin/src/api/client.ts`, `admin/src/api/vendors.ts`, `admin/src/api/templates.ts`, `admin/src/api/admin.ts`
- `admin/src/pages/Dashboard.tsx`, `admin/src/pages/Vendors.tsx`, `admin/src/pages/VendorForm.tsx`, `admin/src/pages/Templates.tsx`, `admin/src/pages/TemplateForm.tsx`, `admin/src/pages/TestSend.tsx`
- `admin/src/components/Layout.tsx`, `admin/src/components/Table.tsx`, `admin/src/components/StatusBadge.tsx`, `admin/src/components/EmptyState.tsx`, `admin/src/components/ConfirmDialog.tsx`
- `src/routes/admin.routes.ts`

### Modified files (4)
- `src/index.ts` — register admin routes + SPA serving
- `wrangler.jsonc` — add admin assets + route
- `package.json` — add admin scripts
- `README.md` — add admin UI section
