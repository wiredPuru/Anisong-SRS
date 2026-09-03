import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, utimesSync } from "node:fs";
import { open } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getStreamCacheMaxBytes } from "./mediaLibrary.ts";
import { DOWNLOAD_TIMEOUT_MS, USER_AGENT } from "./mediaDownload.ts";

const CACHE_DIR = resolve(process.cwd(), ".data/stream-cache");

// How long an oversized (bigger than the configured cap) fetch is left on
// disk after being served once, before its temp file is cleaned up - long
// enough to outlast the response stream reading it.
const EPHEMERAL_CLEANUP_DELAY_MS = 30_000;

export function getStreamCacheDir(): string {
  return CACHE_DIR;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function cacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function extensionFromUrl(url: string): string {
  const match = /\.[a-zA-Z0-9]+$/.exec(new URL(url).pathname);
  return match ? match[0] : "";
}

function cachedPathFor(url: string): string {
  return join(CACHE_DIR, `${cacheKey(url)}${extensionFromUrl(url)}`);
}

export function parseAllowedStreamUrl(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const isAnimethemesHost = parsed.hostname === "animethemes.moe" || parsed.hostname.endsWith(".animethemes.moe");
  return parsed.protocol === "https:" && isAnimethemesHost ? parsed : null;
}

function touchAccess(path: string): void {
  try {
    utimesSync(path, new Date(), statSync(path).mtime);
  } catch {
    // best-effort - a failed atime touch just makes this file look older than
    // it is for eviction purposes, not a functional problem.
  }
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

async function fetchToTempFile(url: string, tempPath: string): Promise<{ size: number } | { error: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    return { error: isTimeout(err) ? "Fetch timed out." : "Failed to fetch the file." };
  }

  if (!response.ok || !response.body) {
    return { error: "Failed to fetch the file." };
  }

  const fileHandle = await open(tempPath, "w");
  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await fileHandle.write(value);
    }
  } catch (err) {
    await fileHandle.close();
    if (existsSync(tempPath)) unlinkSync(tempPath);
    return { error: isTimeout(err) ? "Fetch timed out." : "Failed to fetch the file." };
  }

  await fileHandle.close();
  return { size: statSync(tempPath).size };
}

async function fetchAndCache(url: string, destPath: string): Promise<{ path: string } | { error: string }> {
  const tempPath = `${destPath}.tmp-${process.pid}-${Date.now()}`;
  const result = await fetchToTempFile(url, tempPath);
  if ("error" in result) return result;

  const maxBytes = getStreamCacheMaxBytes();
  if (result.size > maxBytes) {
    // Bigger than the whole configured cache - serve it once without
    // persisting it, then clean up the temp file after a delay generous
    // enough to outlast the response stream reading it.
    setTimeout(() => {
      if (existsSync(tempPath)) unlinkSync(tempPath);
    }, EPHEMERAL_CLEANUP_DELAY_MS).unref();
    return { path: tempPath };
  }

  renameSync(tempPath, destPath);
  enforceStreamCacheQuota();
  return { path: destPath };
}

const inFlight = new Map<string, Promise<{ path: string } | { error: string }>>();

export function resolveCachedPath(url: string): Promise<{ path: string } | { error: string }> {
  ensureCacheDir();
  const destPath = cachedPathFor(url);

  if (existsSync(destPath)) {
    touchAccess(destPath);
    return Promise.resolve({ path: destPath });
  }

  const key = cacheKey(url);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = fetchAndCache(url, destPath).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

// Peek-only lookup, never fetches. Lets a caller reuse an already-cached
// remote clip (e.g. one played back before being downloaded) instead of
// re-fetching bytes the app already has on disk.
export function cachedFilePathIfPresent(url: string): string | null {
  if (!parseAllowedStreamUrl(url)) return null;
  ensureCacheDir();
  const destPath = cachedPathFor(url);
  if (!existsSync(destPath)) return null;
  touchAccess(destPath);
  return destPath;
}

export function enforceStreamCacheQuota(): void {
  ensureCacheDir();
  const maxBytes = getStreamCacheMaxBytes();

  const entries = readdirSync(CACHE_DIR)
    .filter((name) => !name.includes(".tmp-"))
    .map((name) => {
      const path = join(CACHE_DIR, name);
      const stats = statSync(path);
      return { path, size: stats.size, atimeMs: stats.atime.getTime() };
    });

  let total = entries.reduce((sum, entry) => sum + entry.size, 0);
  if (total <= maxBytes) return;

  const oldestFirst = entries.sort((a, b) => a.atimeMs - b.atimeMs);
  for (const entry of oldestFirst) {
    if (total <= maxBytes) break;
    try {
      unlinkSync(entry.path);
      total -= entry.size;
    } catch {
      // best-effort - move on to the next candidate
    }
  }
}
