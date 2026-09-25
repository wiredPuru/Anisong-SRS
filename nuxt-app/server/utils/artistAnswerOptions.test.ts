import { describe, expect, it } from "vitest";
import { toArtistAnswerOptions } from "./artistAnswerOptions";

const artist = (name: string) => ({ name });

describe("artist answer options", () => {
  it("returns only the redacted fields", () => {
    const spoiler = {
      ...artist("YOASOBI"),
      id: 8355,
      source: "anisongdb",
      slug: "yoasobi",
      songTitle: "Idol",
      animeTitleRomaji: "Oshi no Ko",
      animeAniListId: 150672,
      themeSlot: "OP1",
      videoUrl: "https://example.test/idol.webm",
      audioUrl: "https://example.test/idol.mp3",
    };

    expect(toArtistAnswerOptions([spoiler])).toEqual([{ key: "yoasobi", artistName: "YOASOBI" }]);
  });

  it("trims names, drops blanks, and deduplicates case-insensitively", () => {
    expect(toArtistAnswerOptions([artist("  YOASOBI  "), artist("yoasobi"), artist("  "), artist(""), artist("LiSA")])).toEqual([
      { key: "yoasobi", artistName: "YOASOBI" },
      { key: "lisa", artistName: "LiSA" },
    ]);
  });

  it("caps results at ten", () => {
    const many = Array.from({ length: 25 }, (_, index) => artist(`Artist ${index}`));
    expect(toArtistAnswerOptions(many)).toHaveLength(10);
  });
});
