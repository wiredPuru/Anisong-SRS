import { describe, expect, it } from "vitest";
import { toSongAnswerOptions } from "./songAnswerOptions";

const entry = (songTitle: string | null, artistName: string | null = "LiSA") => ({ songTitle, artistName });

describe("song answer options", () => {
  it("returns only the redacted fields", () => {
    const spoiler = { ...entry("Gurenge"), animeTitleRomaji: "Kimetsu no Yaiba", animeAniListId: 101922, themeSlot: "OP1", videoUrl: "https://example.test/a.webm" };
    expect(toSongAnswerOptions([spoiler])).toEqual([{ key: "gurenge|lisa", songTitle: "Gurenge", artistName: "LiSA" }]);
  });

  it("collapses the same song and artist, and keeps a shared title under different artists", () => {
    const options = toSongAnswerOptions([entry("Gurenge"), entry("GURENGE"), entry("Gurenge", "Someone Else")]);
    expect(options.map((option) => option.artistName)).toEqual(["LiSA", "Someone Else"]);
  });

  it("drops entries with no usable title and trims what it keeps", () => {
    expect(toSongAnswerOptions([entry(null), entry("   "), entry("  Gurenge  ", "  LiSA  ")])).toEqual([
      { key: "gurenge|lisa", songTitle: "Gurenge", artistName: "LiSA" },
    ]);
  });

  it("keeps a missing artist as null rather than dropping the song", () => {
    expect(toSongAnswerOptions([entry("Gurenge", null)])).toEqual([{ key: "gurenge|", songTitle: "Gurenge", artistName: null }]);
  });

  it("caps the list at ten", () => {
    const many = Array.from({ length: 25 }, (_, index) => entry(`Song ${index}`));
    expect(toSongAnswerOptions(many)).toHaveLength(10);
  });
});
