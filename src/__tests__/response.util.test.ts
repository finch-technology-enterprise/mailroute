import { describe, it, expect } from "vitest";
import { ApiResponse } from "../utils/response.util";

describe("ApiResponse", () => {
  it("returns success response with data", () => {
    const res = ApiResponse(true, "ok", { id: 1 });
    expect(res.success).toBe(true);
    expect(res.message).toBe("ok");
    expect(res.data).toEqual({ id: 1 });
  });

  it("returns failure response without data", () => {
    const res = ApiResponse(false, "error");
    expect(res.success).toBe(false);
    expect(res.message).toBe("error");
    expect(res.data).toBeNull();
  });

  it("returns success with null message", () => {
    const res = ApiResponse(true, null, [1, 2, 3]);
    expect(res.success).toBe(true);
    expect(res.message).toBeNull();
    expect(res.data).toEqual([1, 2, 3]);
  });

  it("returns failure with null data", () => {
    const res = ApiResponse(false, "not found");
    expect(res.success).toBe(false);
    expect(res.data).toBeNull();
  });
});
