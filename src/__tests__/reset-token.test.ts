import { describe, it, expect } from "vitest";
import { generateResetToken, verifyResetToken } from "../lib/reset-token";

const SECRET = "test-reset-secret";

describe("reset-token", () => {
  it("generates and verifies a valid token", async () => {
    const token = await generateResetToken("user@example.com", SECRET);
    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);

    const payload = await verifyResetToken(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.email).toBe("user@example.com");
  });

  it("rejects expired token", async () => {
    const token = await generateResetToken("user@example.com", SECRET, -1);
    const payload = await verifyResetToken(token, SECRET);
    expect(payload).toBeNull();
  });

  it("rejects tampered token", async () => {
    const token = await generateResetToken("user@example.com", SECRET);
    const dot = token.lastIndexOf(".");
    const tampered = "eyJtYWxsaWNpb3VzIjogInRydWUifQ" + token.slice(dot);
    const payload = await verifyResetToken(tampered, SECRET);
    expect(payload).toBeNull();
  });

  it("rejects malformed token", async () => {
    const payload = await verifyResetToken("no-dot-here", SECRET);
    expect(payload).toBeNull();
  });

  it("rejects token with wrong secret", async () => {
    const token = await generateResetToken("user@example.com", "other-secret");
    const payload = await verifyResetToken(token, SECRET);
    expect(payload).toBeNull();
  });
});
