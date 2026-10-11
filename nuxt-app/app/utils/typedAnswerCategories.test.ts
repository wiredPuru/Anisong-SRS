import { describe, expect, it } from "vitest";
import { DEFAULT_TYPED_ANSWER_CATEGORIES, hasAnswerCategory, trackWithoutAnime } from "./typedAnswerCategories";

const base = { ...DEFAULT_TYPED_ANSWER_CATEGORIES };

describe("hasAnswerCategory", () => {
  it("is true by default (anime name on)", () => {
    expect(hasAnswerCategory(base)).toBe(true);
  });

  it("is false when nothing that can be guessed alone is on", () => {
    expect(hasAnswerCategory({ anime: false, themeSlot: true, songName: false, artist: false })).toBe(false);
  });

  it.each([{ songName: true }, { artist: true }])("is true with anime off and %j on", (extra) => {
    expect(hasAnswerCategory({ ...base, anime: false, ...extra })).toBe(true);
  });
});

describe("trackWithoutAnime", () => {
  it("is null while anime name is on, whatever else is", () => {
    expect(trackWithoutAnime({ ...base, songName: true, artist: true })).toBeNull();
  });

  it.each([
    [{ songName: true, artist: false }, "song"],
    [{ songName: false, artist: true }, "artist"],
    [{ songName: true, artist: true }, "song+artist"],
  ] as const)("names the track for %j", (extra, expected) => {
    expect(trackWithoutAnime({ ...base, anime: false, themeSlot: false, ...extra })).toBe(expected);
  });

  it("is null when nothing is left to grade", () => {
    expect(trackWithoutAnime({ ...base, anime: false })).toBeNull();
  });
});
