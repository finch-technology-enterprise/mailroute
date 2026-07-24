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

const MAX_BODY_SIZE_KB = 50;
const MAX_BODY_SIZE = 1024 * MAX_BODY_SIZE_KB;

// API app scoped to /api
const api = new Hono<{ Bindings: CloudflareBindings }>().basePath("/api");

api.use(
  "*",
  requestId(),
  secureHeaders({
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
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

// Main app — mounts the API and serves the SPA at /admin/*
const app = new Hono<{ Bindings: CloudflareBindings }>();
app.route("/", api);

app.get("/admin*", async (c) => {
  const url = new URL(c.req.url);
  let path = url.pathname.replace("/admin", "") || "/";
  path = path === "/" ? "/index.html" : path;
  const reqUrl = new URL(path, "http://assets");
  const res = await c.env.ADMIN_ASSETS.fetch(reqUrl);
  if (res.status === 200) return res;
  const fallback = await c.env.ADMIN_ASSETS.fetch(
    new URL("/index.html", "http://assets"),
  );
  if (fallback.status === 200) return fallback;
  return c.text("Not found", 404);
});

export default {
  /**
   * HTTP Handler (Hono)
   */
  fetch: app.fetch,
};
