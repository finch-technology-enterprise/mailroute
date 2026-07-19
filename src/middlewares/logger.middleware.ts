// src/middlewares/logger.middleware.ts
import { Context, Next } from "hono";
import { flattenObject, LogToNewRelic } from "../utils/helpers.util";
import { CloudflareBindings } from "../lib/cloudflare.binding";

// Never ship these to the logging backend (lowercase; headers are lowercased).
const REDACTED_HEADERS = new Set(["x-api-auth-key", "authorization", "cookie"]);
const REDACTED_BODY_FIELDS = new Set([
  "otp",
  "code",
  "password",
  "token",
  "secret",
  "apikey",
]);
const REDACTED = "[REDACTED]";

function redactBody(body: any): any {
  if (!body || typeof body !== "object" || Array.isArray(body)) return body;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (REDACTED_BODY_FIELDS.has(key.toLowerCase())) {
      out[key] = REDACTED;
    } else if (key.toLowerCase() === "content" && typeof value === "string") {
      // Avoid logging full email HTML; keep a small, non-sensitive preview.
      out[key] =
        value.length > 256 ? `${value.slice(0, 256)}… (truncated)` : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

export const LoggerMiddleware = async (
  c: Context<{ Bindings: CloudflareBindings }>,
  next: Next,
) => {
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const requestHeaders: Record<string, string> = {};

  for (const [key, value] of Object.entries(c.req.header())) {
    requestHeaders[`context.header.${key}`] = REDACTED_HEADERS.has(
      key.toLowerCase(),
    )
      ? REDACTED
      : value;
  }

  const requestClone = c.req.raw.clone();
  let requestBody: any = {};

  try {
    if (method !== "GET") {
      const contentType = c.req.header("content-type") || "";
      if (contentType.includes("application/json")) {
        requestBody = await requestClone.json();
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const rawText = await requestClone.text();
        const decodedText = decodeURIComponent(rawText);
        if (decodedText.trim().startsWith("{")) {
          requestBody = JSON.parse(decodedText);
        } else {
          const params = new URLSearchParams(rawText);
          const obj: Record<string, string> = {};
          params.forEach((value, key) => {
            obj[key] = value;
          });
          requestBody = obj;
        }
      }
    }
  } catch (e) {
    requestBody = { raw: "Could not parse request body" };
  }

  LogToNewRelic(
    c,
    `HTTP request by IP ${c.req.header("cf-connecting-ip")}. [${method}::${path}][RequestID: ${c.get("requestId")}]`,
    {
      "context.request_id": c.get("requestId"),
      "context.content_size": `${(parseInt(c.req.header("content-length") || "0") / 1024).toFixed(2)} KB`,
      ...requestHeaders,
      ...flattenObject({ "context.request": redactBody(requestBody) }),
    },
  );

  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  LogToNewRelic(
    c,
    `HTTP response for IP ${c.req.header("cf-connecting-ip")}. [${method}::${path}][RequestID: ${c.get("requestId")}]`,
    {
      "context.request_id": c.get("requestId"),
      "context.status": c.res.status,
      "context.duration_ms": duration,
    },
  );
};
