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

const MAX_BODY_SIZE_KB = 50;
const MAX_BODY_SIZE = 1024 * MAX_BODY_SIZE_KB;

const app = new Hono<{ Bindings: CloudflareBindings }>().basePath("/email/api");

/**
 * Global Middlewares
 */
app.use(
  "*",
  // Order matters: assign a request id and enforce the body-size limit
  // BEFORE the logger reads/clones the body, so oversized payloads are
  // rejected without being parsed and every log line has a request id.
  requestId(),
  secureHeaders(),
  bodyLimit({
    maxSize: MAX_BODY_SIZE,
    onError: (c) => {
      return c.text("overflow :(", 413);
    },
  }),
  LoggerMiddleware,
);

/**
 * Error Handler
 */
app.onError(ErrorHandler);

/**
 *  Public Routes
 */
app.route("/", generalRoutes);

/**
 *  Admin Routes (auth via X-API-AUTH-KEY)
 */
app.route("/admin", adminRoutes);

/**
 *  SPA Serving — catch-all for /email/admin/* client-side routing
 */
app.get("/admin/:path*", async (c) => {
  const path = c.req.param("path") || "index.html";
  const res = await c.env.ADMIN_ASSETS.fetch(new URL(path, "http://localhost"));
  if (res.status === 200) return res;
  return c.env.ADMIN_ASSETS.fetch(new URL("index.html", "http://localhost"));
});

export default {
  /**
   * HTTP Handler (Hono)
   */
  fetch: app.fetch,
};
