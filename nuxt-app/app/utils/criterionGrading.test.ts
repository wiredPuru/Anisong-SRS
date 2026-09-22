import { describe, expect, it } from "vitest";
import {
  GRADING_CRITERIA,
  buildCriterion,
  criterionCategories,
  describeCriterion,
  gradeTypedRound,
  requiredCategories,
} from "./criterionGrading";

describe("criterionCategories / buildCriterion", () => {
  it.each(GRADING_CRITERIA)("%s round-trips", (criterion) => {
    expect(buildCriterion(criterionCategories(criterion))).toBe(criterion);
  });

  it("orders any input canonically and de-duplicates", () => {
    expect(buildCriterion(["artist", "slot", "title", "slot"])).toBe("title+slot+artist");
  });

  it("returns null for an empty set or slot without title", () => {
    expect(buildCriterion([])).toBeNull();
    expect(buildCriterion(["slot"])).toBeNull();
    expect(buildCriterion(["song", "slot", "artist"])).toBeNull();
  });
});

describe("requiredCategories", () => {
  it.each([
    ["title", { anime: true, songName: false, themeSlot: false, artist: false }],
    ["song", { anime: false, songName: true, themeSlot: false, artist: false }],
    ["artist", { anime: false, songName: false, themeSlot: false, artist: true }],
    ["title+song", { anime: true, songName: true, themeSlot: false, artist: false }],
    ["title+slot", { anime: true, songName: false, themeSlot: true, artist: false }],
    ["title+artist", { anime: true, songName: false, themeSlot: false, artist: true }],
    ["song+artist", { anime: false, songName: true, themeSlot: false, artist: true }],
    ["title+song+slot", { anime: true, songName: true, themeSlot: true, artist: false }],
    ["title+song+artist", { anime: true, songName: true, themeSlot: false, artist: true }],
    ["title+slot+artist", { anime: true, songName: false, themeSlot: true, artist: true }],
    ["title+song+slot+artist", { anime: true, songName: true, themeSlot: true, artist: true }],
  ] as const)("%s requires %j", (criterion, expected) => {
    expect(requiredCategories(criterion)).toEqual(expected);
  });
});

describe("gradeTypedRound", () => {
  const allRight = { anime: "pass", song: true, themeSlot: true, artist: true } as const;
  type Key = keyof typeof allRight;
  const wrongValues: Record<Key, readonly ("fail" | false | null)[]> = {
    anime: ["fail", null],
    song: [false, null],
    themeSlot: [false, null],
    artist: [false, null],
  };
  const requiredKey: Record<Key, keyof ReturnType<typeof requiredCategories>> = {
    anime: "anime",
    song: "songName",
    themeSlot: "themeSlot",
    artist: "artist",
  };

  it.each(GRADING_CRITERIA)("%s passes when every answer is right", (criterion) => {
    expect(gradeTypedRound(criterion, allRight)).toBe("pass");
  });

  it.each(GRADING_CRITERIA)("%s fails on a wrong or blank required answer only", (criterion) => {
    const required = requiredCategories(criterion);
    for (const key of Object.keys(allRight) as Key[]) {
      for (const wrong of wrongValues[key]) {
        const result = gradeTypedRound(criterion, { ...allRight, [key]: wrong });
        expect(result).toBe(required[requiredKey[key]] ? "fail" : "pass");
      }
    }
  });

  it("keeps the 71b title+song cases", () => {
    const blank = { themeSlot: null, artist: null };
    expect(gradeTypedRound("title+song", { anime: "pass", song: true, ...blank })).toBe("pass");
    expect(gradeTypedRound("title+song", { anime: "pass", song: null, ...blank })).toBe("fail");
    expect(gradeTypedRound("title+song", { anime: null, song: true, ...blank })).toBe("fail");
    expect(gradeTypedRound("title", { anime: "pass", song: false, ...blank })).toBe("pass");
    expect(gradeTypedRound("song", { anime: "fail", song: true, ...blank })).toBe("pass");
  });
});

describe("describeCriterion", () => {
  it("keeps the exact strings Study showed before feature 72", () => {
    expect(describeCriterion("song")).toEqual({
      chip: "Song name",
      prompt: "Grade yourself on the song name",
      track: "Song",
      spoken: "the song name",
    });
    expect(describeCriterion("title+song")).toEqual({
      chip: "Anime + song",
      prompt: "Grade yourself on the anime and the song name",
      track: "Anime + song",
      spoken: "the anime and the song name",
    });
  });

  it("names a single new category", () => {
    expect(describeCriterion("artist")).toEqual({
      chip: "Artist",
      prompt: "Grade yourself on the artist",
      track: "Artist",
      spoken: "the artist",
    });
  });

  it("names three and four categories", () => {
    expect(describeCriterion("title+slot+artist")).toEqual({
      chip: "Anime + OP/ED + artist",
      prompt: "Grade yourself on the anime, the OP/ED number and the artist",
      track: "Anime + OP/ED + artist",
      spoken: "the anime, the OP/ED number and the artist",
    });
    expect(describeCriterion("title+song+slot+artist").chip).toBe("Anime + song + OP/ED + artist");
  });
});
