import { describe, it, expect } from "vitest";
import { flattenObject } from "../utils/helpers.util";

describe("flattenObject", () => {
  it("flattens nested object", () => {
    const input = { a: { b: 1, c: 2 }, d: 3 };
    const result = flattenObject(input);
    expect(result).toEqual({ "a.b": 1, "a.c": 2, "d": 3 });
  });

  it("handles empty object", () => {
    expect(flattenObject({})).toEqual({});
  });

  it("handles null values", () => {
    const input = { a: null, b: { c: null } };
    const result = flattenObject(input);
    expect(result).toEqual({ "a": null, "b.c": null });
  });
});
