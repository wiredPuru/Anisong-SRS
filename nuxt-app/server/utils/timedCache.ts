/** Caches one async value for ttlMs; a failure is never cached, so the next call retries. */
export function createTimedCache<T>(load: () => Promise<T>, ttlMs: number, now: () => number = Date.now) {
  let value: T | undefined;
  let expiresAt = 0;
  return async (): Promise<T> => {
    if (value !== undefined && now() < expiresAt) return value;
    const fresh = await load();
    value = fresh;
    expiresAt = now() + ttlMs;
    return fresh;
  };
}
