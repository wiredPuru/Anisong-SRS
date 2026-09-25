import { describe, expect, it } from "vitest";
import { buildSourceLinks } from "./sourceLinks";

const card = { animeAniListId: 130003, animeAnimethemesSlug: "bocchi_the_rock", animethemesVideoSlug: "OP1-NCBD1080" };

describe("buildSourceLinks", () => {
  it("links AniList and the exact AnimeThemes theme page when both slugs are known", () => {
    expect(buildSourceLinks(card)).toEqual([
      { site: "anilist", label: "AniList", href: "https://anilist.co/anime/130003", title: "Open on AniList" },
      {
        site: "animethemes",
        label: "AnimeThemes",
        href: "https://animethemes.moe/anime/bocchi_the_rock/OP1-NCBD1080",
        title: "Open this theme on AnimeThemes",
      },
    ]);
  });

  it("falls back to the show page without a video slug", () => {
    const links = buildSourceLinks({ ...card, animethemesVideoSlug: null });
    expect(links[1]).toMatchObject({
      href: "https://animethemes.moe/anime/bocchi_the_rock",
      title: "Open the show on AnimeThemes",
    });
  });

  it("gives AniList only without an anime slug, even with a video slug", () => {
    expect(buildSourceLinks({ ...card, animeAnimethemesSlug: null }).map((link) => link.site)).toEqual(["anilist"]);
    expect(buildSourceLinks({ ...card, animeAnimethemesSlug: null, animethemesVideoSlug: null })).toHaveLength(1);
  });

  it("encodes path segments", () => {
    const links = buildSourceLinks({ animeAniListId: 1, animeAnimethemesSlug: "a/b c", animethemesVideoSlug: "OP1?x" });
    expect(links[1]!.href).toBe("https://animethemes.moe/anime/a%2Fb%20c/OP1%3Fx");
  });
});
