/// <reference types="@cloudflare/vitest-pool-workers/types" />

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Worker smoke test", () => {
  it("serves the OpenAPI document through the Worker runtime", async () => {
    const response = await SELF.fetch("https://example.test/api/openapi.json");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");

    const body = (await response.json()) as { openapi?: unknown };
    expect(body.openapi).toBe("3.1.0");
  });
});
