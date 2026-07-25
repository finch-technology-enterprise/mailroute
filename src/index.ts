// src/index.ts
import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import { CloudflareBindings } from "./lib/cloudflare.binding";

// Middlewares
import { LoggerMiddleware } from "./middlewares/logger.middleware";
import { ErrorHandler } from "./middlewares/error.middleware";

// Routes
import generalRoutes from "./routes/general.routes";
import adminRoutes from "./routes/admin.routes";
import authRoutes from "./routes/auth.routes";
import webhookRoutes from "./routes/webhook.routes";

const MAX_BODY_SIZE_KB = 50;
const MAX_BODY_SIZE = 1024 * MAX_BODY_SIZE_KB;

// API app scoped to /api
const api = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

api.use(
  "*",
  requestId(),
  secureHeaders({
    strictTransportSecurity:
      "max-age=31536000; includeSubDomains; preload",
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  }),
  bodyLimit({
    maxSize: MAX_BODY_SIZE,
    onError: (c) => {
      return c.text("overflow :(", 413);
    },
  }),
  LoggerMiddleware,
);

api.onError(ErrorHandler);

api.route("/", generalRoutes);
api.route("/auth", authRoutes);
api.route("/admin", adminRoutes);
api.route("/webhooks", webhookRoutes);

// API v1 — same handlers, versioned prefix for clients that want stability
const apiV1 = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api/v1");
apiV1.route("/", generalRoutes);
apiV1.route("/auth", authRoutes);
apiV1.route("/admin", adminRoutes);
apiV1.route("/webhooks", webhookRoutes);

// Main app — mounts the API, API v1, and serves the SPA at /admin/*
const app = new Hono<{ Bindings: CloudflareBindings }>();
app.route("/", api);
app.route("/", apiV1);

const ADMIN_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

function withSecurityHeaders(res: Response): Response {
  const headers = new Headers(res.headers);
  if (!headers.has("Content-Security-Policy")) {
    headers.set("Content-Security-Policy", ADMIN_CSP);
  }
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

app.get("/admin*", async (c) => {
  const url = new URL(c.req.url);
  let path = url.pathname.replace("/admin", "") || "/";
  path = path === "/" ? "/index.html" : path;
  const reqUrl = new URL(path, "http://assets");
  const res = await c.env.ADMIN_ASSETS.fetch(reqUrl);
  if (res.status === 200) return withSecurityHeaders(res);
  const fallback = await c.env.ADMIN_ASSETS.fetch(
    new URL("/index.html", "http://assets"),
  );
  if (fallback.status === 200) return withSecurityHeaders(fallback);
  return c.text("Not found", 404);
});

function validateEnv(env: CloudflareBindings): string | null {
  const requiredSecrets: [string, string | undefined][] = [
    ["JWT_SECRET", env.JWT_SECRET],
    ["CONFIG_ENCRYPTION_KEY", env.CONFIG_ENCRYPTION_KEY],
  ];
  for (const [name, value] of requiredSecrets) {
    if (!value || value.startsWith("dev-") || value.startsWith("<") || value.startsWith("your-")) {
      return `${name} is not configured or still has a placeholder value`;
    }
  }
  return null;
}

export default {
  fetch: async (
    request: Request,
    env: CloudflareBindings,
    ctx: ExecutionContext,
  ) => {
    const err = validateEnv(env);
    if (err) {
      console.error("Startup validation failed:", err);
      return new Response(
        JSON.stringify({ success: false, message: "Server configuration error" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
    return app.fetch(request, env, ctx);
  },
};
