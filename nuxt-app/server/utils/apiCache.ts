import { createHash } from "node:crypto";
import { count, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { apiCache } from "../db/schema.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";

export const DAY_MS = 24 * 60 * 60 * 1000;
/** How long past its expiry an entry is kept to answer when a provider is down. */
export const STALE_GRACE_MS = 30 * DAY_MS;
export const MAX_CACHE_ROWS = 20_000;
/** A provider answer of "nothing here" is remembered, but only briefly. */
export const NOT_FOUND_TTL_MS = 6 * 60 * 60 * 1000;

export interface CacheEntry {
  body: string;
  fetchedAt: number;
  expiresAt: number;
}

export interface CacheStore {
  get(key: string): CacheEntry | null;
  set(key: string, provider: string, entry: CacheEntry): void;
  prune(now: number): void;
}

export function cacheKey(provider: string, parts: unknown): string {
  return createHash("sha256").update(`${provider}\n${stableStringify(parts)}`).digest("hex");
}

// Sorted keys, so the same variables always hash the same however they were built.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function createApiCache(store: CacheStore, now: () => number = Date.now) {
  /**
   * Answers from the cache while fresh, otherwise runs the request and stores
   * its result (null included). If the provider is unavailable, an expired
   * entry is served instead of the error.
   */
  async function through<T>(provider: string, parts: unknown, ttlMs: number, run: () => Promise<T>): Promise<T> {
    const key = cacheKey(provider, parts);
    const entry = store.get(key);
    if (entry && entry.expiresAt > now()) return JSON.parse(entry.body) as T;

    try {
      const value = await run();
      const at = now();
      store.set(key, provider, {
        body: JSON.stringify(value ?? null),
        fetchedAt: at,
        expiresAt: at + (value === null ? Math.min(ttlMs, NOT_FOUND_TTL_MS) : ttlMs),
      });
      store.prune(at);
      return value;
    } catch (error) {
      if (error instanceof ProviderUnavailableError && entry) return JSON.parse(entry.body) as T;
      throw error;
    }
  }

  return { through };
}

const dbStore: CacheStore = {
  get(key) {
    const row = db.select().from(apiCache).where(eq(apiCache.key, key)).get();
    return row ? { body: row.body, fetchedAt: row.fetchedAt, expiresAt: row.expiresAt } : null;
  },
  set(key, provider, entry) {
    db.insert(apiCache)
      .values({ key, provider, ...entry })
      .onConflictDoUpdate({ target: apiCache.key, set: { provider, ...entry } })
      .run();
  },
  prune(at) {
    db.delete(apiCache).where(lt(apiCache.expiresAt, at - STALE_GRACE_MS)).run();
    const total = db.select({ n: count() }).from(apiCache).get()?.n ?? 0;
    if (total > MAX_CACHE_ROWS) {
      db.run(sql`DELETE FROM api_cache WHERE key IN (SELECT key FROM api_cache ORDER BY fetched_at ASC LIMIT ${total - MAX_CACHE_ROWS})`);
    }
  },
};

export const apiResponseCache = createApiCache(dbStore);

export function apiCacheStats(): { entries: number } {
  return { entries: db.select({ n: count() }).from(apiCache).get()?.n ?? 0 };
}

export function clearApiCache(): number {
  const { entries } = apiCacheStats();
  db.delete(apiCache).run();
  return entries;
}
