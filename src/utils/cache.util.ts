export interface TimedCache<T> {
  value: T;
  expiresAt: number;
  staleUntil: number;
}

export function createCachedLoader<T>(
  loadFn: () => Promise<T>,
  ttlMs: number,
  swrMs = ttlMs / 2,
) {
  let cache: TimedCache<T> | null = null;
  let loading: Promise<T> | null = null;

  return {
    async get(): Promise<T> {
      const now = Date.now();
      if (cache && cache.expiresAt > now) return cache.value;
      if (cache && cache.staleUntil > now) {
        if (!loading) {
          const loadPromise = loadFn()
            .then((value) => {
              const resolveNow = Date.now();
              cache = { value, expiresAt: resolveNow + ttlMs, staleUntil: resolveNow + ttlMs + swrMs };
              loading = null;
              return value;
            });
          loadPromise.catch(() => {
            loading = null;
          });
          loading = loadPromise;
        }
        return cache.value;
      }
      const value = await loadFn();
      cache = { value, expiresAt: now + ttlMs, staleUntil: now + ttlMs + swrMs };
      return value;
    },
    invalidate(): void {
      cache = null;
      loading = null;
    },
  };
}
