# API Documentation Page in Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "API Docs" page to the admin SPA that embeds Swagger UI with the OpenAPI spec, auto-fills the user's API key for "Try it out", and adds a nav item in the sidebar.

**Architecture:** Install `swagger-ui-react` in the admin workspace. New `ApiDocs.tsx` page fetches `/api/openapi.json` and renders it via Swagger UI's React component. A `requestInterceptor` injects the stored `X-API-AUTH-KEY` from localStorage. CSP on the backend is relaxed for `style-src` on `/admin*` responses to allow Swagger UI's dynamic styles.

**Tech Stack:** React, swagger-ui-react, Tailwind, Hono (backend), Cloudflare Workers

## Global Constraints

- CSP for admin pages: `style-src` must include `'unsafe-inline'` in addition to `'self' 'nonce-${nonce}'`
- API key stored in localStorage under key `mailroute_api_key`
- OpenAPI spec served at `/api/openapi.json`
- Swagger UI version: latest from npm (`swagger-ui-react`)
- New page mounted at `/api-docs` path inside the authenticated layout

---

### Task 1: Install swagger-ui-react dependency

**Files:**
- Modify: `admin/package.json`

**Interfaces:**
- Consumes: none
- Produces: `swagger-ui-react` available for import

- [ ] **Step 1: Add swagger-ui-react to dependencies**

Run: `npm install swagger-ui-react --workspace=admin`

This installs `swagger-ui-react` and its CSS dependency.

- [ ] **Step 2: Verify install**

Check that `admin/package.json` now has `"swagger-ui-react"` in `dependencies`.

---

### Task 2: Create ApiDocs page component

**Files:**
- Create: `admin/src/pages/ApiDocs.tsx`

**Interfaces:**
- Consumes: `hasAuthKey()` from `../api/client`; fetch `/api/openapi.json`
- Produces: React component `<ApiDocsPage />` that renders Swagger UI

- [ ] **Step 1: Create the page file**

```tsx
import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import AnimatedPage from "../components/AnimatedPage";
import { hasAuthKey } from "../api/client";
import { Link } from "react-router-dom";

export default function ApiDocsPage() {
  const [spec, setSpec] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/openapi.json");
        if (!res.ok) throw new Error(`Failed to load spec (${res.status})`);
        setSpec(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load API spec");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const apiKey = typeof window !== "undefined"
    ? localStorage.getItem("mailroute_api_key")
    : null;

  if (loading) {
    return (
      <AnimatedPage>
        <h1 className="mb-6">API Documentation</h1>
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer" style={{ height: 28, width: "40%", marginBottom: 32 }} />
          {[1,2,3].map(i => (
            <div key={i} className="card p-5">
              <div className="skeleton-shimmer" style={{ height: 14, width: "30%", marginBottom: 12 }} />
              <div className="skeleton-shimmer" style={{ height: 12, width: "60%" }} />
            </div>
          ))}
        </div>
      </AnimatedPage>
    );
  }

  if (error) {
    return (
      <AnimatedPage>
        <h1 className="mb-6">API Documentation</h1>
        <div className="card p-6" style={{ color: "var(--red)" }}>
          <p>{error}</p>
        </div>
      </AnimatedPage>
    );
  }

  if (!apiKey) {
    return (
      <AnimatedPage>
        <h1 className="mb-6">API Documentation</h1>
        <div className="card p-6" style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "var(--text-secondary)" }}>
            You need an API key to test the endpoints. Create one on the{" "}
            <Link to="/api-keys" style={{ color: "var(--accent)" }}>API Keys page</Link>.
          </p>
        </div>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <h1 className="mb-6">API Documentation</h1>
      <p className="mb-6" style={{ color: "var(--text-secondary)", fontSize: 14 }}>
        Your API key is pre-filled. Click "Try it out" on any endpoint to send a real request.
      </p>
      <div className="swagger-container">
        <SwaggerUI
          spec={spec as Record<string, unknown>}
          requestInterceptor={(req: any) => {
            req.headers["X-API-AUTH-KEY"] = apiKey;
            return req;
          }}
          defaultModelsExpandDepth={-1}
          docExpansion={"list" as any}
        />
      </div>
    </AnimatedPage>
  );
}
```

- [ ] **Step 2: Verify the file is created**

Check `admin/src/pages/ApiDocs.tsx` exists with the content above.

---

### Task 3: Add route and lazy import in App.tsx

**Files:**
- Modify: `admin/src/App.tsx`

**Interfaces:**
- Consumes: `<ApiDocsPage />` from Task 2
- Produces: route at `/api-docs` inside the `<Layout>` wrapper

- [ ] **Step 1: Add lazy import**

Insert after line 12 (`const ApiKeysPage = ...`):
```typescript
const ApiDocsPage = lazy(() => import("./pages/ApiDocs"));
```

- [ ] **Step 2: Add route**

Insert between the activity route and the api-keys route (after line 46 and before the settings route):
```tsx
<Route path="api-docs" element={<ApiDocsPage />} />
```

The relevant section should look like:
```tsx
<Route path="activity" element={<ActivityLogPage />} />
<Route path="api-docs" element={<ApiDocsPage />} />
<Route path="settings" element={<ChangePasswordPage />} />
<Route path="api-keys" element={<ApiKeysPage />} />
```

---

### Task 4: Add nav item in Layout

**Files:**
- Modify: `admin/src/components/Layout.tsx`

**Interfaces:**
- Consumes: none
- Produces: "API Docs" nav item between Activity and API Keys in sidebar + bottom nav

- [ ] **Step 1: Add nav item to the array**

Insert between the activity entry and the api-keys entry:
```typescript
{ to: "/api-docs", label: "API Docs", icon: "api-docs" },
```

The navItems array should now be:
```typescript
const navItems = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/vendors", label: "Vendors", icon: "vendors" },
  { to: "/templates", label: "Templates", icon: "templates" },
  { to: "/test-send", label: "Test Send", icon: "test-send" },
  { to: "/activity", label: "Activity", icon: "activity" },
  { to: "/api-docs", label: "API Docs", icon: "api-docs" },
  { to: "/api-keys", label: "API Keys", icon: "key" },
  { to: "/settings", label: "Settings", icon: "config" },
];
```

- [ ] **Step 2: Add api-docs icon to Icon component**

Open `admin/src/components/Icon.tsx` and add an `api-docs` entry (book icon):
```typescript
"api-docs": <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /><path d="M12 6v6l2-1.5 2 1.5V6" /></>,
```

---

### Task 5: Relax CSP for admin pages

**Files:**
- Modify: `src/index.ts`

**Interfaces:**
- Consumes: `cspWithNonce()` function
- Produces: `style-src` includes `'unsafe-inline'` for admin SPA responses only

- [ ] **Step 1: Add admin-specific CSP function**

Add after `cspWithNonce` (after line 101):
```typescript
function adminCspWithNonce(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
    "img-src 'self' data: https:",
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
```

- [ ] **Step 2: Update withSecurityHeaders for admin path**

Change the `cspWithNonce(nonce)` call on line 106 to use the admin CSP when the request is for `/admin/`:

Replace the `withSecurityHeaders` function to accept a path parameter:
```typescript
async function withSecurityHeaders(res: Response, nonce: string, isAdmin?: boolean): Promise<Response> {
  const headers = new Headers(res.headers);
  headers.set("Content-Security-Policy", isAdmin ? adminCspWithNonce(nonce) : cspWithNonce(nonce));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  let body = res.body;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    const text = res.body ? await res.clone().text() : "";
    body = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text.replace(/__CSP_NONCE__/g, nonce)));
        controller.close();
      },
    });
  }
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}
```

Then update the calls in the `/admin*` handler (lines 135, 139) to pass `true`:
```typescript
if (res.status === 200) return withSecurityHeaders(res, nonce, true);
const fallback = await c.env.ADMIN_ASSETS.fetch(
  new URL("/index.html", "http://assets"),
);
if (fallback.status === 200) return withSecurityHeaders(fallback, nonce, true);
```

---

### Task 6: Add Swagger UI CSS scope

**Files:**
- Modify: `admin/src/index.css`

**Interfaces:**
- Consumes: Swagger UI CSS (imported via `swagger-ui-react/swagger-ui.css`)
- Produces: Scoped Swagger UI styles that don't leak into rest of app

- [ ] **Step 1: Add Swagger UI container styles**

Append to `admin/src/index.css`:
```css
.swagger-container .swagger-ui {
  color: var(--text-primary);
}
.swagger-container .swagger-ui .topbar { display: none; }
.swagger-container .swagger-ui .info { margin: 16px 0; }
.swagger-container .swagger-ui .info .title {
  color: var(--text-primary);
  font-size: 20px;
}
.swagger-container .swagger-ui .info .description p {
  color: var(--text-secondary);
}
.swagger-container .swagger-ui .opblock-tag {
  color: var(--text-primary);
  font-size: 14px;
}
.swagger-container .swagger-ui .opblock .opblock-summary-description {
  color: var(--text-secondary);
}
.swagger-container .swagger-ui .opblock .opblock-summary-method {
  font-size: 12px;
}
.swagger-container .swagger-ui table thead tr td,
.swagger-container .swagger-ui table thead tr th {
  color: var(--text-secondary);
}
.swagger-container .swagger-ui .btn {
  border-radius: 6px;
}
```

---

### Task 7: Verify the build

- [ ] **Step 1: Build the admin SPA**

Run: `npm run build:admin`

Expected: no errors, `admin/dist/` is updated.

- [ ] **Step 2: Build the full project**

Run: `npm run build`

Expected: TypeScript compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add admin/package.json admin/package-lock.json admin/src/pages/ApiDocs.tsx admin/src/App.tsx admin/src/components/Layout.tsx admin/src/components/Icon.tsx admin/src/index.css src/index.ts
git commit -m "feat: add API docs page with embedded Swagger UI in dashboard"
```
