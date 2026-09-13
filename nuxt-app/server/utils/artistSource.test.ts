import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRequestError, ProviderUnavailableError } from "../lib/graphql.ts";
import { fetchArtistThemesBySlug, searchArtistsOnAnimeThemes } from "../lib/animethemes.ts";
import { fetchArtistCatalog, searchArtists } from "../lib/anisongdb.ts";
import { isArtistCandidate, resolveArtistThemes, searchArtistCandidates, type ArtistCandidate } from "./artistSource.ts";

vi.mock("../lib/animethemes.ts", () => ({
  fetchArtistThemesBySlug: vi.fn(),
  searchArtistsOnAnimeThemes: vi.fn(),
}));
vi.mock("../lib/anisongdb.ts", () => ({ fetchArtistCatalog: vi.fn(), searchArtists: vi.fn() }));

const artistSearch = vi.mocked(searchArtistsOnAnimeThemes);
const artistThemes = vi.mocked(fetchArtistThemesBySlug);
const catalog = vi.mocked(fetchArtistCatalog);
const anisongArtistSearch = vi.mocked(searchArtists);

const anisongCandidate: ArtistCandidate = { source: "anisongdb", id: 8355, name: "YOASOBI", slug: null };
const animethemesCandidate: ArtistCandidate = { source: "animethemes", id: 726, name: "YOASOBI", slug: "yoasobi" };

const catalogTheme = (overrides = {}) => ({
  annSongId: 31487,
  themeSlot: "OP1",
  songTitle: "Kaibutsu",
  artistName: "YOASOBI",
  animeAniListId: 114194,
  animeTitleRomaji: "Beastars",
  videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
  audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
  ...overrides,
});

const animethemesTheme = (overrides = {}) => ({
  animethemesThemeId: 9139,
  themeSlot: "OP1",
  songTitle: "Kaibutsu",
  songTitleNative: "怪物",
  animeAniListId: 114194,
  animeAnimethemesId: 1502,
  animeTitleRomaji: "Beastars",
  videoUrl: "https://v.animethemes.moe/slow.webm",
  audioUrl: "https://a.animethemes.moe/slow.ogg",
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  catalog.mockResolvedValue([catalogTheme()]);
  anisongArtistSearch.mockResolvedValue([{ id: 8355, name: "YOASOBI" }]);
  artistSearch.mockResolvedValue([{ id: 726, name: "YOASOBI", slug: "yoasobi" }]);
  artistThemes.mockResolvedValue({ artistName: "YOASOBI", entries: [animethemesTheme()] });
});

describe("artist candidate search", () => {
  it("prefers AnisongDB and does not call AnimeThemes at all", async () => {
    expect(await searchArtistCandidates("YOASOBI")).toEqual([anisongCandidate]);
    expect(artistSearch).not.toHaveBeenCalled();
  });

  it("returns an empty list rather than falling back when AnisongDB has no match", async () => {
    anisongArtistSearch.mockResolvedValue([]);
    expect(await searchArtistCandidates("nobody")).toEqual([]);
    expect(artistSearch).not.toHaveBeenCalled();
  });

  it("falls back to AnimeThemes, carrying its slug, when AnisongDB is unavailable", async () => {
    anisongArtistSearch.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    expect(await searchArtistCandidates("YOASOBI")).toEqual([animethemesCandidate]);
  });

  it("surfaces a rejected request instead of masking it with a fallback", async () => {
    anisongArtistSearch.mockRejectedValue(new ProviderRequestError("AnisongDB rejected the request (422)."));
    await expect(searchArtistCandidates("YOASOBI")).rejects.toThrow("rejected the request");
    expect(artistSearch).not.toHaveBeenCalled();
  });

  it("produces candidates the import route will accept", async () => {
    expect((await searchArtistCandidates("YOASOBI")).every(isArtistCandidate)).toBe(true);
    anisongArtistSearch.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    expect((await searchArtistCandidates("YOASOBI")).every(isArtistCandidate)).toBe(true);
  });
});

describe("artist candidate validation", () => {
  it.each([
    ["an AnisongDB candidate", anisongCandidate, true],
    ["an AnimeThemes candidate", animethemesCandidate, true],
    ["an unknown source", { ...anisongCandidate, source: "spotify" }, false],
    ["a missing source", { id: 1, name: "x", slug: null }, false],
    ["a non-numeric id", { ...anisongCandidate, id: "8355" }, false],
    ["a zero id", { ...anisongCandidate, id: 0 }, false],
    ["a blank name", { ...anisongCandidate, name: "  " }, false],
    ["an AnimeThemes candidate with no slug", { ...animethemesCandidate, slug: null }, false],
    ["null", null, false],
    ["a string", "yoasobi", false],
  ])("treats %s as valid=%s", (_label, value, expected) => {
    expect(isArtistCandidate(value)).toBe(expected);
  });
});

describe("artist theme resolution", () => {
  it("maps an AnisongDB catalog onto the app's shape, carrying its clip URLs", async () => {
    expect(await resolveArtistThemes(anisongCandidate)).toEqual({
      artistName: "YOASOBI",
      entries: [{
        animethemesThemeId: null,
        themeSlot: "OP1",
        songTitle: "Kaibutsu",
        songTitleNative: null,
        animeAniListId: 114194,
        animeAnimethemesId: null,
        animeTitleRomaji: "Beastars",
        videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
        audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
      }],
    });
  });

  it("never calls AnimeThemes for an AnisongDB candidate", async () => {
    await resolveArtistThemes(anisongCandidate);
    expect(artistSearch).not.toHaveBeenCalled();
    expect(artistThemes).not.toHaveBeenCalled();
  });

  it("keeps a theme AnisongDB numbers differently from AnimeThemes", async () => {
    catalog.mockResolvedValue([catalogTheme({ themeSlot: "ED2", songTitle: "Yasashii Suisei" })]);
    expect((await resolveArtistThemes(anisongCandidate))!.entries[0])
      .toMatchObject({ themeSlot: "ED2", songTitle: "Yasashii Suisei" });
  });

  it("lets an AnisongDB outage surface rather than silently emptying the catalog", async () => {
    catalog.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    await expect(resolveArtistThemes(anisongCandidate)).rejects.toMatchObject({ statusCode: 503 });
  });

  it("leaves an AnimeThemes candidate on its existing path", async () => {
    expect(await resolveArtistThemes(animethemesCandidate)).toEqual({
      artistName: "YOASOBI",
      entries: [animethemesTheme()],
    });
    expect(catalog).not.toHaveBeenCalled();
    expect(artistThemes).toHaveBeenCalledWith("yoasobi");
  });

  it("reports an AnimeThemes artist that no longer resolves", async () => {
    artistThemes.mockResolvedValue(null);
    expect(await resolveArtistThemes(animethemesCandidate)).toBeNull();
  });
});
