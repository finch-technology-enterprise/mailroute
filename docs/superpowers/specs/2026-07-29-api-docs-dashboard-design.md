# API Documentation Page in Dashboard

## Problem

The email microservice exposes a REST API (`/api/send-email`, `/api/send-template`, `/api/send-otp`, `/api/send-batch`) authenticated via `X-API-AUTH-KEY` header. While the API is functional and API keys can be created in the dashboard, developers integrating other services have no visibility into the API from the dashboard — no endpoint reference, no payload shapes, no way to test.

A Swagger UI page already exists at `/api/docs`, but it is not linked from the admin SPA and is unknown to most users.

## Solution

Embed Swagger UI as a React component on a new `/api-docs` page inside the admin SPA. This provides interactive documentation (endpoint reference + "Try it out") with zero additional backend work, since the OpenAPI spec is already served at `/api/openapi.json`.

## Design

### New Page: `/api-docs`

A new route in the admin SPA that renders a full-page Swagger UI component.

**Location in navigation:** Between "Activity" and "API Keys" in the sidebar and mobile bottom nav.

**Nav label:** "API Docs"

### Auth integration

The page reads the user's stored API key from `localStorage` (same key used elsewhere in the SPA) and injects it as the `X-API-AUTH-KEY` header via Swagger UI's `requestInterceptor`. Every "Try it out" request from Swagger UI will include this header automatically.

If no API key is stored (user hasn't created one), the page shows a banner with a link to `/api-keys` directing them to create one first, then come back.

### CSP

The admin SPA has a strict Content Security Policy that blocks inline styles. Swagger UI renders with dynamic styles, so `style-src` must include `'unsafe-inline'` for admin SPA responses only. The existing nonce-based script policy remains unchanged.

## Implementation

### Files to change

| File | Change |
|---|---|
| `admin/package.json` | Add `swagger-ui-react` dependency |
| `admin/src/App.tsx` | Add route `<Route path="api-docs" element={<ApiDocsPage />} />` |
| `admin/src/pages/ApiDocs.tsx` | **New file** — fetches OpenAPI spec, renders SwaggerUI with request interceptor |
| `admin/src/components/Layout.tsx` | Add "API Docs" nav item to sidebar and mobile nav |
| `admin/src/index.css` | Import `swagger-ui-react/swagger-ui.css` |
| `src/index.ts` | Relax `style-src` CSP for `/admin*` to include `'unsafe-inline'` |

### Data flow

```
User navigates to /api-docs
  → ApiDocsPage mounts
  → fetch("/api/openapi.json")
  → SwaggerUI renders with:
      spec={spec}
      requestInterceptor={(req) => {
        req.headers["X-API-AUTH-KEY"] = apiKey;
        return req;
      }}
  → User browses endpoints, clicks "Try it out" with their API key pre-filled
```

### Scope

**In scope:**
- New `/api-docs` page with embedded Swagger UI
- Nav item in sidebar and mobile bottom nav
- Auto-fill `X-API-AUTH-KEY` from stored key
- CSP relaxation for admin SPA styles
- Prompt to create API key if none exists

**Out of scope:**
- Customizing Swagger UI theme to match app design (uses its own CSS)
- Adding new API endpoints or modifying the OpenAPI spec
- Documenting webhook/tracking endpoints (they are in the spec already)
- Code snippet customization (Swagger UI provides built-in examples)
