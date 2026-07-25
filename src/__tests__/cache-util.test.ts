import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCachedLoader } from "../utils/cache.util";

describe("createCachedLoader", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("loads value on first call", async () => {
    const loadFn = vi.fn().mockResolvedValue("value-1");
    const loader = createCachedLoader(loadFn, 1000);

    const result = await loader.get();
    expect(result).toBe("value-1");
    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it("returns cached value within TTL", async () => {
    const loadFn = vi.fn().mockResolvedValue("cached");
    const loader = createCachedLoader(loadFn, 1000);

    await loader.get();
    await loader.get();
    await loader.get();

    expect(loadFn).toHaveBeenCalledTimes(1);
  });

  it("reloads after TTL expires", async () => {
    const loadFn = vi.fn().mockResolvedValue("fresh");
    const loader = createCachedLoader(loadFn, 1000);

    await loader.get();
    vi.advanceTimersByTime(1001);
    await loader.get();

    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it("invalidates cache on demand", async () => {
    let value = "old";
    const loadFn = vi.fn().mockImplementation(async () => value);
    const loader = createCachedLoader(loadFn, 10000);

    expect(await loader.get()).toBe("old");

    value = "new";
    loader.invalidate();
    expect(await loader.get()).toBe("new");
    expect(loadFn).toHaveBeenCalledTimes(2);
  });

  it("handles async errors gracefully", async () => {
    const loadFn = vi.fn().mockRejectedValue(new Error("load failed"));
    const loader = createCachedLoader(loadFn, 1000);

    await expect(loader.get()).rejects.toThrow("load failed");
  });
});
