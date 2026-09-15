import { describe, expect, it } from "vitest";
import { CLIP_SOURCES, isClipSource, isClipUrlAllowed } from "./clipSource.ts";

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

describe("isClipSource", () => {
  it.each(CLIP_SOURCES)("accepts %s", (value) => {
    expect(isClipSource(value)).toBe(true);
  });

  it.each([["foo"], [""], ["Both"], [null], [undefined], [1]])("rejects %s", (value) => {
    expect(isClipSource(value)).toBe(false);
  });
});
