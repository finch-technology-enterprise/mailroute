export const spec = {
  openapi: "3.1.0",
  info: {
    title: "Mailroute API",
    version: "1.0.0",
    description: "Transactional email API with scheduling, templates, tracking, and webhook status callbacks.",
  },
  servers: [{ url: "/api", description: "API v1" }, { url: "/api/v1", description: "API v1 (versioned)" }],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["General"],
        responses: { "200": { description: "Service healthy" }, "503": { description: "Database unreachable" } },
      },
    },
    "/send-otp": {
      post: {
        summary: "Send OTP email",
        tags: ["General"],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { to: { type: "string", format: "email" }, otp: { type: "string" } }, required: ["to", "otp"] } } },
        },
        responses: { "200": { description: "OTP sent" } },
      },
    },
    "/send-email": {
      post: {
        summary: "Send a single email",
        tags: ["General"],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { to: { type: "string", format: "email" }, subject: { type: "string" }, content: { type: "string" }, cc: { type: "string", format: "email" }, bcc: { type: "string", format: "email" }, track: { type: "boolean" }, sendAt: { type: "string", format: "date-time" } }, required: ["to", "subject", "content"] } } },
        },
        responses: { "200": { description: "Email sent or scheduled" } },
      },
    },
    "/send-batch": {
      post: {
        summary: "Send batch emails",
        tags: ["General"],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { emails: { type: "array", items: { type: "object" } } }, required: ["emails"] } } },
        },
        responses: { "200": { description: "Batch sent or scheduled" } },
      },
    },
    "/send-template": {
      post: {
        summary: "Send template-based email",
        tags: ["General"],
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { to: { type: "string", format: "email" }, template: { type: "string" }, subject: { type: "string" }, replacements: { type: "object" }, track: { type: "boolean" }, sendAt: { type: "string", format: "date-time" } }, required: ["to", "template"] } } },
        },
        responses: { "200": { description: "Template email sent or scheduled" } },
      },
    },
    "/auth/signup": {
      post: {
        summary: "Register a new tenant + admin user",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string", format: "email" }, password: { type: "string" }, tenantName: { type: "string" }, tenantSlug: { type: "string" } }, required: ["name", "email", "password", "tenantName", "tenantSlug"] } } },
        },
        responses: { "201": { description: "User created" }, "409": { description: "Conflict" } },
      },
    },
    "/auth/login": {
      post: {
        summary: "Login",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" }, password: { type: "string" } }, required: ["email", "password"] } } },
        },
        responses: { "200": { description: "Logged in" }, "401": { description: "Invalid credentials" } },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Refresh auth token",
        tags: ["Auth"],
        responses: { "200": { description: "Token refreshed" } },
      },
    },
    "/auth/logout": {
      post: {
        summary: "Logout",
        tags: ["Auth"],
        responses: { "200": { description: "Logged out" } },
      },
    },
    "/auth/me": {
      get: {
        summary: "Get current user",
        tags: ["Auth"],
        security: [{ BearerAuth: [] }],
        responses: { "200": { description: "User profile" } },
      },
    },
    "/auth/verify-email": {
      get: {
        summary: "Verify email address",
        tags: ["Auth"],
        parameters: [{ name: "token", in: "query", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Email verified" } },
      },
    },
    "/auth/forgot-password": {
      post: {
        summary: "Request password reset",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { email: { type: "string", format: "email" } }, required: ["email"] } } },
        },
        responses: { "200": { description: "Reset link sent" } },
      },
    },
    "/auth/reset-password": {
      post: {
        summary: "Reset password",
        tags: ["Auth"],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { token: { type: "string" }, password: { type: "string" } }, required: ["token", "password"] } } },
        },
        responses: { "200": { description: "Password reset" } },
      },
    },
    "/auth/change-password": {
      post: {
        summary: "Change password",
        tags: ["Auth"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { currentPassword: { type: "string" }, newPassword: { type: "string" } }, required: ["currentPassword", "newPassword"] } } },
        },
        responses: { "200": { description: "Password changed" } },
      },
    },
    "/admin/vendor-health": { get: { summary: "Vendor health status", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Health info" } } } },
    "/admin/vendors": { get: { summary: "List vendors", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Vendor list" } } }, post: { summary: "Create vendor", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "201": { description: "Vendor created" } } } },
    "/admin/vendors/{id}": { put: { summary: "Update vendor", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Vendor updated" } } }, delete: { summary: "Delete vendor", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Vendor deleted" } } } },
    "/admin/templates": { get: { summary: "List templates", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Template list" } } }, post: { summary: "Create template", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "201": { description: "Template created" } } } },
    "/admin/templates/{id}": { put: { summary: "Update template", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Template updated" } } }, delete: { summary: "Delete template", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Template deleted" } } } },
    "/admin/templates/{id}/preview": { post: { summary: "Preview template", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Preview result" } } } },
    "/admin/stats": { get: { summary: "Dashboard stats", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Stats" } } } },
    "/admin/test-send": { post: { summary: "Send test email", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Test sent" } } } },
    "/admin/logs": { get: { summary: "Activity & send logs", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Log entries" } } } },
    "/admin/logs/export": { get: { summary: "Export logs", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "format", in: "query", schema: { type: "string", enum: ["csv", "json"] } }], responses: { "200": { description: "Exported file" } } } },
    "/admin/api-keys": { get: { summary: "List API keys", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "API keys" } } }, post: { summary: "Create API key", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "201": { description: "API key created" } } } },
    "/admin/api-keys/{id}": { delete: { summary: "Revoke API key", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "API key revoked" } } } },
    "/admin/users": { get: { summary: "List users", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "User list" } } }, post: { summary: "Create user", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "201": { description: "User created" } } } },
    "/admin/users/{id}": { put: { summary: "Update user", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "User updated" } } }, delete: { summary: "Delete user", tags: ["Admin"], security: [{ BearerAuth: [] }], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "User deleted" } } } },
    "/admin/push/subscribe": { post: { summary: "Subscribe to push notifications", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Subscribed" } } }, delete: { summary: "Unsubscribe from push", tags: ["Admin"], security: [{ BearerAuth: [] }], responses: { "200": { description: "Unsubscribed" } } } },
    "/webhooks/{vendor}": { post: { summary: "Receive delivery status webhook", tags: ["Webhooks"], parameters: [{ name: "vendor", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "Status updated" }, "401": { description: "Invalid signature" } } } },
    "/track/open/{id}": { get: { summary: "Open tracking pixel", tags: ["Tracking"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { "200": { description: "1×1 GIF" } } } },
    "/track/click/{id}": { get: { summary: "Click tracking redirect", tags: ["Tracking"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "url", in: "query", required: true, schema: { type: "string", format: "uri" } }], responses: { "302": { description: "Redirect to target" } } } },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: "apiKey", in: "header", name: "x-api-key", description: "API key authentication" },
      BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "JWT token authentication" },
    },
  },
} as const;

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mailroute API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #f5f5f5; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger-ui" });
  </script>
</body>
</html>`;

export function swaggerUiHtml(): string {
  return SWAGGER_UI_HTML;
}
