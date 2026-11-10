import { describe, expect, it } from "vitest";
import { CLIP_SOURCES, clipOrigin, clipOriginName, isClipUrlAllowed, isRemoteUrlAllowed } from "./clipSource";

const AMQ_URLS = [
  "https://naedist.animemusicquiz.com/byvisp.webm",
  "https://eudist.animemusicquiz.com/qi299l.mp3",
];
const ANIMETHEMES_URLS = [
  "https://v.animethemes.moe/CowboyBebop-OP1.webm",
  "https://a.animethemes.moe/CowboyBebop-OP1.ogg",
];

describe("isClipUrlAllowed", () => {
  it.each(AMQ_URLS)("allows AMQ host %s only in anisongdb and both", (url) => {
    expect(isClipUrlAllowed(url, "anisongdb")).toBe(true);
    expect(isClipUrlAllowed(url, "both")).toBe(true);
    expect(isClipUrlAllowed(url, "animethemes")).toBe(false);
  });

  it.each(ANIMETHEMES_URLS)("allows animethemes.moe host %s only in animethemes and both", (url) => {
    expect(isClipUrlAllowed(url, "animethemes")).toBe(true);
    expect(isClipUrlAllowed(url, "both")).toBe(true);
    expect(isClipUrlAllowed(url, "anisongdb")).toBe(false);
  });

  it.each([
    ["a lookalike suffix", "https://animethemes.moe.evil.com/x.webm"],
    ["a lookalike prefix", "https://notanimemusicquiz.com/x.webm"],
    ["the domain inside a path", "https://evil.test/animemusicquiz.com/x.webm"],
    ["plain http", "http://naedist.animemusicquiz.com/x.webm"],
    ["an unrelated host", "https://example.test/x.webm"],
    ["a non-URL", "not a url"],
    ["an empty string", ""],
  ])("rejects %s in every mode", (_label, url) => {
    for (const source of CLIP_SOURCES) {
      expect(isClipUrlAllowed(url, source)).toBe(false);
    }
  });
});

describe("isRemoteUrlAllowed", () => {
  it("rejects null in every mode", () => {
    for (const source of CLIP_SOURCES) {
      expect(isRemoteUrlAllowed(null, source)).toBe(false);
    }
  });

  it("defers to isClipUrlAllowed for a real URL", () => {
    expect(isRemoteUrlAllowed(AMQ_URLS[0]!, "anisongdb")).toBe(true);
    expect(isRemoteUrlAllowed(AMQ_URLS[0]!, "animethemes")).toBe(false);
  });
});

describe("clipOrigin", () => {
  it("prefers a local file over a remote URL", () => {
    expect(clipOrigin("/themes/a.webm", AMQ_URLS[0]!)).toBe("library");
  });

  it.each(AMQ_URLS)("names AMQ host %s as AnisongDB", (url) => {
    expect(clipOrigin(null, url)).toBe("anisongdb");
  });

  it.each(ANIMETHEMES_URLS)("names animethemes.moe host %s as AnimeThemes", (url) => {
    expect(clipOrigin(null, url)).toBe("animethemes");
  });

  it.each([
    ["an unknown host", "https://example.com/x.webm"],
    ["an invalid URL", "not a url"],
    ["plain http", "http://naedist.animemusicquiz.com/x.webm"],
    ["no source", null],
  ])("returns null for %s", (_label, url) => {
    expect(clipOrigin(null, url)).toBeNull();
  });

  it("gives each origin a display name", () => {
    expect(clipOriginName("library")).toBe("your library");
    expect(clipOriginName("anisongdb")).toBe("AnisongDB");
    expect(clipOriginName("animethemes")).toBe("AnimeThemes.moe");
  });
});
