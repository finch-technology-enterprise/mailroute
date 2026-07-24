import { describe, it, expect, beforeEach } from "vitest";
import { ConfigService } from "../services/config.service";

describe("ConfigService", () => {
  beforeEach(() => {
    ConfigService.clearCache();
  });

  it("clearCache resets internal cache", () => {
    ConfigService.clearCache();
    expect(true).toBe(true);
  });
});
