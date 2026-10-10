import { describe, expect, it, vi } from "vitest";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { cacheKey, createApiCache, type CacheEntry, type CacheStore } from "./apiCache.ts";

function memoryStore(): CacheStore & { rows: Map<string, CacheEntry> } {
  const rows = new Map<string, CacheEntry>();
  return { rows, get: (k) => rows.get(k) ?? null, set: (k, _p, e) => void rows.set(k, e), prune: () => {} };
}

describe("cacheKey", () => {
  it("ignores key order and undefined values", () => {
    expect(cacheKey("a", { x: 1, y: [2, { b: 1, a: 2 }] })).toBe(cacheKey("a", { y: [2, { a: 2, b: 1 }], x: 1, z: undefined }));
  });

  it("separates providers and different variables", () => {
    expect(cacheKey("a", { x: 1 })).not.toBe(cacheKey("b", { x: 1 }));
    expect(cacheKey("a", { x: 1 })).not.toBe(cacheKey("a", { x: 2 }));
  });
});

describe("createApiCache.through", () => {
  it("runs once, then answers from the cache until it expires", async () => {
    let now = 1000;
    const cache = createApiCache(memoryStore(), () => now);
    const run = vi.fn().mockResolvedValue({ a: 1 });
    expect(await cache.through("p", "q", 500, run)).toEqual({ a: 1 });
    expect(await cache.through("p", "q", 500, run)).toEqual({ a: 1 });
    expect(run).toHaveBeenCalledTimes(1);
    now = 1600;
    await cache.through("p", "q", 500, run);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("remembers a not-found answer", async () => {
    const cache = createApiCache(memoryStore(), () => 0);
    const run = vi.fn().mockResolvedValue(null);
    expect(await cache.through("p", "q", 500, run)).toBeNull();
    expect(await cache.through("p", "q", 500, run)).toBeNull();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("serves an expired entry when the provider is unavailable", async () => {
    let now = 0;
    const cache = createApiCache(memoryStore(), () => now);
    await cache.through("p", "q", 100, async () => "old");
    now = 1000;
    const down = vi.fn().mockRejectedValue(new ProviderUnavailableError("P"));
    expect(await cache.through("p", "q", 100, down)).toBe("old");
  });

  it("rethrows when there is nothing cached, and never caches a failure", async () => {
    const store = memoryStore();
    const cache = createApiCache(store, () => 0);
    await expect(cache.through("p", "q", 100, async () => { throw new ProviderUnavailableError("P"); })).rejects.toBeInstanceOf(ProviderUnavailableError);
    expect(store.rows.size).toBe(0);
  });

  it("does not hide other errors behind a stale entry", async () => {
    let now = 0;
    const cache = createApiCache(memoryStore(), () => now);
    await cache.through("p", "q", 100, async () => "old");
    now = 1000;
    await expect(cache.through("p", "q", 100, async () => { throw new Error("bad query"); })).rejects.toThrow("bad query");
  });
});
