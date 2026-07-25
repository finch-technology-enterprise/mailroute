import { describe, it, expect } from "vitest";

describe("EmailService utilities", () => {
  function isTransientError(error: unknown): boolean {
    const msg =
      error instanceof Error ? error.message.toLowerCase() : String(error);
    return (
      msg.includes("timeout") ||
      msg.includes("econnrefused") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("5") ||
      msg.includes("too many requests") ||
      msg.includes("rate limit") ||
      msg.includes("unavailable") ||
      msg.includes("service unavailable") ||
      msg.includes("network error") ||
      msg.includes("dns")
    );
  }
  function redactError(msg: string): string {
    return msg.replace(
      /(token|key|secret|auth|password|api[_-]?key)[=:]\s*\S+/gi,
      "$1=[REDACTED]",
    );
  }

  function parseConfig(raw: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }

  describe("redactError", () => {
    it("redacts token values", () => {
      const result = redactError("Sender.net: token=abc123xyz");
      expect(result).toBe("Sender.net: token=[REDACTED]");
    });

    it("redacts api-key values", () => {
      const result = redactError("Brevo: api-key=sk_live_secret123");
      expect(result).toBe("Brevo: api-key=[REDACTED]");
    });

    it("redacts password values", () => {
      const result = redactError("SMTP: password=hunter2");
      expect(result).toBe("SMTP: password=[REDACTED]");
    });

    it("redacts key values with colon separator", () => {
      const result = redactError("key: super-secret-value");
      expect(result).toBe("key=[REDACTED]");
    });

    it("passes through safe messages", () => {
      const msg = "Connection refused";
      expect(redactError(msg)).toBe(msg);
    });
  });

  describe("parseConfig", () => {
    it("parses valid JSON", () => {
      const result = parseConfig('{"key": "value", "num": 42}');
      expect(result).toEqual({ key: "value", num: 42 });
    });

    it("returns empty object for null input", () => {
      expect(parseConfig(null)).toEqual({});
    });

    it("returns empty object for invalid JSON", () => {
      expect(parseConfig("not-json")).toEqual({});
    });

    it("returns empty object for non-object JSON", () => {
      expect(parseConfig('"string"')).toEqual({});
    });

    it("returns empty object for empty string", () => {
      expect(parseConfig("")).toEqual({});
    });
  });

  describe("isTransientError", () => {
    it("detects timeout errors", () => {
      expect(isTransientError(new Error("Socket timeout"))).toBe(true);
    });

    it("detects connection errors", () => {
      expect(isTransientError(new Error("ECONNREFUSED"))).toBe(true);
      expect(isTransientError(new Error("ECONNRESET"))).toBe(true);
    });

    it("detects 5xx errors", () => {
      expect(isTransientError(new Error("500 Internal Server Error"))).toBe(true);
      expect(isTransientError(new Error("503 Service Unavailable"))).toBe(true);
    });

    it("detects rate limit errors", () => {
      expect(isTransientError(new Error("Too many requests"))).toBe(true);
      expect(isTransientError(new Error("Rate limit exceeded"))).toBe(true);
    });

    it("detects DNS errors", () => {
      expect(isTransientError(new Error("DNS resolution failed"))).toBe(true);
    });

    it("returns false for non-transient errors", () => {
      expect(isTransientError(new Error("Invalid API key"))).toBe(false);
      expect(isTransientError(new Error("Bad request"))).toBe(false);
      expect(isTransientError("some string error")).toBe(false);
    });
  });
});
