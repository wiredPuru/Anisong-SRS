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
