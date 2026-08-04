/** Shared vendor request timeout used by both the interactive send path and the cron scheduler. */
export const VENDOR_TIMEOUT_MS = 10_000;

export function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  ms: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return Promise.race([
    operation(controller.signal),
    new Promise<T>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        reject(new Error(`Vendor timeout after ${ms}ms`));
      });
    }),
  ]).finally(() => clearTimeout(timeout));
}
