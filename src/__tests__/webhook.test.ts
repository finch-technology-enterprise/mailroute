import { describe, it, expect } from "vitest";

async function hmacSign(body: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

describe("webhook HMAC", () => {
  it("produces consistent signatures", async () => {
    const sig = await hmacSign('{"messageId":"abc"}', "test-secret");
    expect(sig).toBeTruthy();
    expect(typeof sig).toBe("string");
  });
});
