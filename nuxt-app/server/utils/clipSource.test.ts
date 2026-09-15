import { describe, expect, it } from "vitest";
import { CLIP_SOURCES, filterClipUrls, isClipSource, isClipUrlAllowed } from "./clipSource.ts";

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

const AMQ_URL = AMQ_URLS[0]!;
const ANIMETHEMES_URL = ANIMETHEMES_URLS[0]!;

describe("filterClipUrls", () => {
  it.each(CLIP_SOURCES)("keeps both null as both null, not blocked, in %s mode", (source) => {
    expect(filterClipUrls(null, null, source)).toEqual({ videoUrl: null, audioUrl: null, clipBlocked: false });
  });

  it("drops both URLs and reports blocked when neither host is allowed", () => {
    expect(filterClipUrls(ANIMETHEMES_URL, ANIMETHEMES_URL, "anisongdb")).toEqual({
      videoUrl: null,
      audioUrl: null,
      clipBlocked: true,
    });
    expect(filterClipUrls(AMQ_URL, AMQ_URL, "animethemes")).toEqual({
      videoUrl: null,
      audioUrl: null,
      clipBlocked: true,
    });
  });

  it("keeps an allowed URL and reports not blocked when the other is absent", () => {
    expect(filterClipUrls(AMQ_URL, null, "anisongdb")).toEqual({
      videoUrl: AMQ_URL,
      audioUrl: null,
      clipBlocked: false,
    });
  });

  it("keeps only the allowed URL from a mixed-provider pair, not blocked", () => {
    // themeSource.ts's merge can pair video from one provider with audio from
    // the other - each field must be checked independently, not as a pair.
    expect(filterClipUrls(AMQ_URL, ANIMETHEMES_URL, "anisongdb")).toEqual({
      videoUrl: AMQ_URL,
      audioUrl: null,
      clipBlocked: false,
    });
    expect(filterClipUrls(AMQ_URL, ANIMETHEMES_URL, "animethemes")).toEqual({
      videoUrl: null,
      audioUrl: ANIMETHEMES_URL,
      clipBlocked: false,
    });
  });

  it("treats undefined the same as null - not blocked, when a loosely-typed caller omits a field", () => {
    expect(filterClipUrls(undefined as unknown as null, undefined as unknown as null, "anisongdb")).toEqual({
      videoUrl: null,
      audioUrl: null,
      clipBlocked: false,
    });
  });

  it("keeps both URLs and reports not blocked in both mode", () => {
    expect(filterClipUrls(AMQ_URL, ANIMETHEMES_URL, "both")).toEqual({
      videoUrl: AMQ_URL,
      audioUrl: ANIMETHEMES_URL,
      clipBlocked: false,
    });
  });
});

describe("isClipSource", () => {
  it.each(CLIP_SOURCES)("accepts %s", (value) => {
    expect(isClipSource(value)).toBe(true);
  });

  it.each([["foo"], [""], ["Both"], [null], [undefined], [1]])("rejects %s", (value) => {
    expect(isClipSource(value)).toBe(false);
  });
});
