import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseAllowedStreamUrl } from "./streamCache.ts";

// The predicate under test needs no settings and no database; mocking the one
// DB-backed import keeps this a pure URL-policy test.
vi.mock("./mediaLibrary.ts", () => ({ getStreamCacheMaxBytes: () => 0 }));

describe("stream URL allowlist", () => {
  it.each([
    "https://v.animethemes.moe/CowboyBebop-OP1.webm",
    "https://a.animethemes.moe/CowboyBebop-OP1.ogg",
    "https://animethemes.moe/file.webm",
    "https://naedist.animemusicquiz.com/byvisp.webm",
    "https://eudist.animemusicquiz.com/qi299l.mp3",
    "https://animemusicquiz.com/file.webm",
  ])("allows %s", (url) => {
    expect(parseAllowedStreamUrl(url)?.href).toBe(url);
  });

  it.each([
    ["a lookalike suffix", "https://animemusicquiz.com.evil.test/x.webm"],
    ["a lookalike prefix", "https://evil-animethemes.moe/x.webm"],
    ["the domain inside a path", "https://evil.test/animemusicquiz.com/x.webm"],
    ["plain http", "http://naedist.animemusicquiz.com/x.webm"],
    ["an unrelated host", "https://example.test/x.webm"],
    ["a non-URL", "not a url"],
    ["an empty string", ""],
  ])("rejects %s", (_label, url) => {
    expect(parseAllowedStreamUrl(url)).toBeNull();
  });
});

describe("removeCachedStream", () => {
  const url = "https://naedist.animemusicquiz.com/byvisp.webm";

  // CACHE_DIR is fixed at module load, so each test points GAQ_SRS_DATA_DIR at
  // a fresh temp dir and re-imports rather than touching the real cache.
  async function loadWithTempCache() {
    vi.stubEnv("GAQ_SRS_DATA_DIR", mkdtempSync(join(tmpdir(), "gaq-cache-")));
    vi.resetModules();
    return import("./streamCache.ts");
  }

  it("removes a cached file that exists", async () => {
    const cache = await loadWithTempCache();
    const dir = cache.getStreamCacheDir();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${createHash("sha256").update(url).digest("hex")}.webm`);
    writeFileSync(file, "clip");

    expect(cache.removeCachedStream(url)).toBe(true);
    expect(existsSync(file)).toBe(false);
  });

  it("is a no-op when nothing is cached", async () => {
    const cache = await loadWithTempCache();
    expect(cache.removeCachedStream(url)).toBe(false);
  });

  it("refuses a non-allowlisted URL", async () => {
    const cache = await loadWithTempCache();
    expect(cache.removeCachedStream("https://example.test/byvisp.webm")).toBe(false);
  });
});
