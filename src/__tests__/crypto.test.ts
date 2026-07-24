import { describe, it, expect } from "vitest";
import { encrypt, decrypt, isEncrypted, generateSecret } from "../lib/crypto";

const TEST_SECRET = "test-encryption-key-12345";

describe("crypto", () => {
  it("decrypt returns original value if not encrypted", async () => {
    const result = await decrypt("hello", TEST_SECRET);
    expect(result).toBe("hello");
  });

  it("encrypt/decrypt round-trip", async () => {
    const original = "sensitive-value-123";
    const encrypted = await encrypt(original, TEST_SECRET);
    expect(encrypted).not.toBe(original);
    expect(isEncrypted(encrypted)).toBe(true);
    const decrypted = await decrypt(encrypted, TEST_SECRET);
    expect(decrypted).toBe(original);
  });

  it("isEncrypted detects prefix", () => {
    expect(isEncrypted("enc:AES-GCM:v1:abc123")).toBe(true);
    expect(isEncrypted("plaintext")).toBe(false);
  });

  it("generateSecret returns hex string of expected length", () => {
    const secret = generateSecret();
    expect(secret).toHaveLength(64);
    expect(/^[0-9a-f]+$/.test(secret)).toBe(true);
  });

  it("generateSecret accepts custom length", () => {
    const secret = generateSecret(16);
    expect(secret).toHaveLength(32);
  });
});
