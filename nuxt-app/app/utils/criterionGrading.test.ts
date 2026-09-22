import { describe, expect, it } from "vitest";
import { gradeTypedRound, requiredCategories } from "./criterionGrading";

describe("requiredCategories", () => {
  it.each([
    ["title", { anime: true, songName: false }],
    ["song", { anime: false, songName: true }],
    ["title+song", { anime: true, songName: true }],
  ] as const)("%s requires %j", (criterion, expected) => {
    expect(requiredCategories(criterion)).toEqual(expected);
  });
});

describe("gradeTypedRound", () => {
  const animeAnswers = ["pass", "fail", null] as const;
  const songAnswers = [true, false, null] as const;

  it.each([
    // title: anime decides, song never matters
    ["title", "pass", true, "pass"],
    ["title", "pass", false, "pass"],
    ["title", "pass", null, "pass"],
    ["title", "fail", true, "fail"],
    ["title", null, true, "fail"],
    // song: song decides, anime never matters
    ["song", null, true, "pass"],
    ["song", "fail", true, "pass"],
    ["song", "pass", false, "fail"],
    ["song", "pass", null, "fail"],
    // title+song: both required, a blank either way fails
    ["title+song", "pass", true, "pass"],
    ["title+song", "pass", false, "fail"],
    ["title+song", "pass", null, "fail"],
    ["title+song", "fail", true, "fail"],
    ["title+song", null, true, "fail"],
  ] as const)("%s with anime %s and song %s is %s", (criterion, anime, song, expected) => {
    expect(gradeTypedRound(criterion, { anime, song })).toBe(expected);
  });

  it("never lets the song change a title-graded round", () => {
    for (const anime of animeAnswers) {
      const results = songAnswers.map((song) => gradeTypedRound("title", { anime, song }));
      expect(new Set(results).size).toBe(1);
    }
  });

  it("never lets the anime change a song-graded round", () => {
    for (const song of songAnswers) {
      const results = animeAnswers.map((anime) => gradeTypedRound("song", { anime, song }));
      expect(new Set(results).size).toBe(1);
    }
  });
});
