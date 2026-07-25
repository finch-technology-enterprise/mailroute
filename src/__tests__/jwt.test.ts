import { describe, it, expect } from "vitest";
import { signJWT, verifyJWT } from "../lib/jwt";

const SECRET = "test-jwt-secret";

describe("JWT", () => {
  it("signs and verifies a valid token", async () => {
    const token = await signJWT(
      { sub: "user-1", tenantId: "tenant-1", role: "admin" },
      SECRET,
    );
    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const payload = await verifyJWT(token, SECRET);
    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe("user-1");
    expect(payload!.tenantId).toBe("tenant-1");
    expect(payload!.role).toBe("admin");
  });

  it("respects custom expiration", async () => {
    const token = await signJWT(
      { sub: "user-1", tenantId: "t-1", role: "admin" },
      SECRET,
      1,
    );
    const payload = await verifyJWT(token, SECRET);
    expect(payload).not.toBeNull();
  });

  it("rejects expired token", async () => {
    const token = await signJWT(
      { sub: "user-1", tenantId: "t-1", role: "admin" },
      SECRET,
      -1,
    );
    const payload = await verifyJWT(token, SECRET);
    expect(payload).toBeNull();
  });

  it("rejects tampered token", async () => {
    const token = await signJWT(
      { sub: "user-1", tenantId: "t-1", role: "admin" },
      SECRET,
    );
    const parts = token.split(".");
    parts[1] = btoa(JSON.stringify({ sub: "attacker" }));
    const tampered = parts.join(".");
    const payload = await verifyJWT(tampered, SECRET);
    expect(payload).toBeNull();
  });

  it("rejects invalid format", async () => {
    const payload = await verifyJWT("invalid-token", SECRET);
    expect(payload).toBeNull();
  });

  it("rejects token signed with different secret", async () => {
    const token = await signJWT(
      { sub: "user-1", tenantId: "t-1", role: "admin" },
      "other-secret",
    );
    const payload = await verifyJWT(token, SECRET);
    expect(payload).toBeNull();
  });
});
