export interface TimedCache<T> {
  value: T;
  expiresAt: number;
}

export function createCachedLoader<T>(loadFn: () => Promise<T>, ttlMs: number) {
  let cache: TimedCache<T> | null = null;

  return {
    async get(): Promise<T> {
      const now = Date.now();
      if (cache && cache.expiresAt > now) return cache.value;
      const value = await loadFn();
      cache = { value, expiresAt: now + ttlMs };
      return value;
    },
    invalidate(): void {
      cache = null;
    },
  };
}
