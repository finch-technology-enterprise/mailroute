// src/utils/helpers.util.ts
import { Context } from "hono";
import { ConfigService } from "../services/config.service";

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

/**
 * Helper for New Relic Logging via API
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
        // Resolved from central D1 config (with env fallback). Loaded inside
        // waitUntil since config access is async; cached, so it's cheap.
        const config = new ConfigService(c.env);
        const [licenseKey, logEndpoint, appEnvironment] = await Promise.all([
          config.get("NEW_RELIC_LICENSE_KEY"),
          config.get("NEW_RELIC_LOG_ENDPOINT"),
          config.get("APP_ENVIRONMENT"),
        ]);
        if (!licenseKey || !logEndpoint) return;

        const cf = req.raw.cf as any;
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
