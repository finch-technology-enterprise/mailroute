// src/utils/helpers.util.ts
import { Context } from "hono";
import type { CloudflareBindings } from "../lib/cloudflare.binding";

/**
 * Utility to flatten nested objects into "dot" notation like Laravel's Arr::dot()
 */
export function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  return Object.keys(obj).reduce((acc: Record<string, unknown>, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (
      typeof obj[k] === "object" &&
      obj[k] !== null &&
      !Array.isArray(obj[k])
    ) {
      Object.assign(
        acc,
        flattenObject(obj[k] as Record<string, unknown>, pre + k),
      );
    } else {
      acc[pre + k] = obj[k];
    }
    return acc;
  }, {});
}

function env(c: Context): CloudflareBindings {
  return c.env as unknown as CloudflareBindings;
}

/**
 * Helper for New Relic Logging via API — reads config from env vars directly
 * so it works for all tenants without D1 dependency.
 */
export function LogToNewRelic(
  c: Context,
  message: string,
  attributes: Record<string, any> = {},
): void {
  const { req } = c;

  c.executionCtx.waitUntil(
    (async () => {
      try {
        const e = env(c);
        const licenseKey = e.NEW_RELIC_LICENSE_KEY;
        const logEndpoint = e.NEW_RELIC_LOG_ENDPOINT || "https://log-api.newrelic.com/log/v1";
        const appEnvironment = e.APP_ENVIRONMENT || "development";
        if (!licenseKey) return;

        const cf = req.raw.cf as Record<string, unknown>;
        const colo = (cf?.colo as string) || "unknown";
        const country = (cf?.country as string) || "unknown";

        const defaults = {
          level: "INFO",
          hostname: `cf-edge-${colo.toLowerCase()}-${country.toLowerCase()}`,
          service: "email-microservice",
          "context.environment": appEnvironment || "unknown",
          "context.colo": colo,
          "context.country": country,
          "context.region": cf?.region || "unknown",
          "context.host": req.header("host") || "unknown",
          "context.ip": req.header("cf-connecting-ip") || "unknown",
          "context.method": req.method,
          "context.url": req.url,
          "newrelic.source": "api.logs",
          timestamp: Date.now(),
        };

        await fetch(logEndpoint, {
          method: "POST",
          headers: {
            "Api-Key": licenseKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            ...defaults,
            ...attributes,
          }),
        });
      } catch (error) {
        console.error("New Relic Logging Failed:", error);
      }
    })(),
  );
}
