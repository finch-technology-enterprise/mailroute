import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateApiKey,
  hashApiKey,
  hashApiKeyLegacy,
} from "../lib/password";

describe("password", () => {
  it("hashPassword produces a parsable string", async () => {
    const encoded = await hashPassword("correct-horse-battery-staple");
    expect(typeof encoded).toBe("string");
    const parts = encoded.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("100000");
  });

  it("verifyPassword succeeds for correct password", async () => {
    const encoded = await hashPassword("my-secure-password");
    const valid = await verifyPassword("my-secure-password", encoded);
    expect(valid).toBe(true);
  });

  it("verifyPassword fails for wrong password", async () => {
    const encoded = await hashPassword("real-password");
    const valid = await verifyPassword("wrong-password", encoded);
    expect(valid).toBe(false);
  });

  it("verifyPassword rejects malformed hash", async () => {
    const valid = await verifyPassword("password", "invalid");
    expect(valid).toBe(false);
  });

  it("generateApiKey returns prefixed key of expected format", () => {
    const key = generateApiKey();
    expect(key.startsWith("mr_")).toBe(true);
    expect(key.length).toBeGreaterThan(30);
  });

  it("generateApiKey produces unique keys", () => {
    const keys = new Set(Array.from({ length: 100 }, () => generateApiKey()));
    expect(keys.size).toBe(100);
  });
});

describe("hashApiKey with HMAC", () => {
  const HMAC_SECRET = "test-hmac-secret";

  it("produces HMAC-prefixed hash with secret", async () => {
    const hash = await hashApiKey("mr_test-key", HMAC_SECRET);
    expect(hash.startsWith("hmac_v1:")).toBe(true);
  });

  it("produces consistent hash for same input", async () => {
    const hash1 = await hashApiKey("mr_test-key", HMAC_SECRET);
    const hash2 = await hashApiKey("mr_test-key", HMAC_SECRET);
    expect(hash1).toBe(hash2);
  });

  it("fallbacks to plain SHA-256 when no secret", async () => {
    const hash = await hashApiKey("mr_test-key");
    expect(hash.startsWith("hmac_v1:")).toBe(false);
  });

  it("legacy hash matches non-HMAC hash", async () => {
    const h1 = await hashApiKey("mr_test-key");
    const h2 = await hashApiKeyLegacy("mr_test-key");
    expect(h1).toBe(h2);
  });

  it("different secrets produce different hashes", async () => {
    const hash1 = await hashApiKey("mr_test-key", "secret-1");
    const hash2 = await hashApiKey("mr_test-key", "secret-2");
    expect(hash1).not.toBe(hash2);
  });
});
