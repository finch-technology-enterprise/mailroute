// src/utils/helpers.util.ts
import { Context } from "hono";
import { ConfigService } from "../services/config.service";

/**
 * Replicates PHP's uniqid() functionality
 */
export function uniqid(
  prefix: string = "",
  moreEntropy: boolean = false,
): string {
  const now = Date.now();
  const seconds = Math.floor(now / 1000).toString(16);
  const microseconds = Math.floor((now % 1000) * 1000)
    .toString(16)
    .padStart(5, "0");
  let id = prefix + seconds + microseconds;
  if (moreEntropy) {
    id += "." + Math.random().toFixed(8).substring(2);
  }
  return id;
}

/**
 * Utility to flatten nested objects into "dot" notation like Laravel's Arr::dot()
 */
export function flattenObject(obj: any, prefix = ""): Record<string, any> {
  return Object.keys(obj).reduce((acc: any, k) => {
    const pre = prefix.length ? prefix + "." : "";
    if (
      typeof obj[k] === "object" &&
      obj[k] !== null &&
      !Array.isArray(obj[k])
    ) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
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

export const hoursToSeconds = (hours: number) => hours * 60 * 60;
export const daysToSeconds = (days: number) => days * 24 * 60 * 60;
export const weeksToSeconds = (weeks: number) => weeks * 7 * 24 * 60 * 60;

export function date(
  formatStr: string = "Y-m-d H:i:s",
  timeZone: string = "Asia/Kuala_Lumpur",
): string {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: timeZone,
  });

  const parts = formatter.formatToParts(now);
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  // Map PHP format characters to Intl parts
  const map: Record<string, string> = {
    Y: p.year, // 2026
    y: p.year.slice(-2), // 26
    m: p.month, // 05
    d: p.day, // 13
    H: p.hour, // 13
    i: p.minute, // 20
    s: p.second, // 59
  };

  // Replace format characters with actual values
  return formatStr.replace(/[YymdHis]/g, (match) => map[match] || match);
}
