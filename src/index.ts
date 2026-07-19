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
    maxSize: 1024 * 50, // 50KB
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

export default {
  /**
   * HTTP Handler (Hono)
   */
  fetch: app.fetch,
};
