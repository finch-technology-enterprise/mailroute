import { describe, it, expect } from "vitest";

function isRateLimited(attempts: number, maxAttempts: number, windowMs: number): boolean {
  return attempts >= maxAttempts;
}

describe("login rate limiting", () => {
  it("allows under-limit attempts", () => {
    expect(isRateLimited(3, 5, 900000)).toBe(false);
  });
  it("blocks over-limit attempts", () => {
    expect(isRateLimited(5, 5, 900000)).toBe(true);
    expect(isRateLimited(6, 5, 900000)).toBe(true);
  });
});
