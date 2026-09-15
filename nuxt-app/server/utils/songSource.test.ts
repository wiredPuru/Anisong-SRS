import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRequestError, ProviderUnavailableError } from "../lib/graphql.ts";
import { searchSongsOnAnimeThemes } from "../lib/animethemes.ts";
import { searchSongs } from "../lib/anisongdb.ts";
import { getClipSource } from "./mediaLibrary.ts";
import { searchSongEntries } from "./songSource.ts";

vi.mock("../lib/animethemes.ts", () => ({ searchSongsOnAnimeThemes: vi.fn() }));
vi.mock("../lib/anisongdb.ts", () => ({ searchSongs: vi.fn() }));
vi.mock("./mediaLibrary.ts", () => ({ getClipSource: vi.fn() }));

const fromAnimeThemes = vi.mocked(searchSongsOnAnimeThemes);
const fromAnisong = vi.mocked(searchSongs);
const clipSource = vi.mocked(getClipSource);

const anisongResult = (overrides = {}) => ({
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

const animethemesEntry = (overrides = {}) => ({
  resultKey: "at:9139",
  animethemesThemeId: 9139,
  themeSlot: "OP1",
  songTitle: "Gurenge",
  songTitleNative: "紅蓮華",
  artistName: "LiSA",
  animeAniListId: 101922,
  animeAnimethemesId: 1502,
  animeTitleRomaji: "Kimetsu no Yaiba",
  videoUrl: "https://v.animethemes.moe/slow.webm",
  audioUrl: "https://a.animethemes.moe/slow.ogg",
  ...overrides,
});

beforeEach(() => {
  fromAnimeThemes.mockReset();
  fromAnisong.mockReset();
  fromAnisong.mockResolvedValue([anisongResult()]);
  fromAnimeThemes.mockResolvedValue([animethemesEntry()]);
  // "both" keeps every fixture URL unfiltered by default; filtering itself is
  // covered by its own describe block below.
  clipSource.mockReset();
  clipSource.mockReturnValue("both");
});

describe("song search source", () => {
  it("prefers AnisongDB and does not call AnimeThemes at all", async () => {
    expect(await searchSongEntries("Kaibutsu")).toEqual([{
      resultKey: "adb:31487",
      animethemesThemeId: null,
      themeSlot: "OP1",
      songTitle: "Kaibutsu",
      songTitleNative: null,
      artistName: "YOASOBI",
      animeAniListId: 114194,
      animeAnimethemesId: null,
      animeTitleRomaji: "Beastars",
      videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
      audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
      clipBlocked: false,
    }]);
    expect(fromAnimeThemes).not.toHaveBeenCalled();
  });

  it("keys AnisongDB and AnimeThemes results into separate namespaces", async () => {
    const [fromFast] = await searchSongEntries("Kaibutsu");
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    const [fromSlow] = await searchSongEntries("Gurenge");
    expect(fromFast!.resultKey).toBe("adb:31487");
    expect(fromSlow!.resultKey).toBe("at:9139");
  });

  it("returns an empty list rather than falling back when AnisongDB simply has no match", async () => {
    fromAnisong.mockResolvedValue([]);
    expect(await searchSongEntries("nonexistent")).toEqual([]);
    expect(fromAnimeThemes).not.toHaveBeenCalled();
  });

  it("falls back to AnimeThemes when AnisongDB is unavailable", async () => {
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    expect(await searchSongEntries("Gurenge")).toEqual([{ ...animethemesEntry(), clipBlocked: false }]);
    expect(fromAnimeThemes).toHaveBeenCalledWith("Gurenge");
  });

  it("surfaces a rejected request instead of masking it with a fallback", async () => {
    fromAnisong.mockRejectedValue(new ProviderRequestError("AnisongDB rejected the request (422)."));
    await expect(searchSongEntries("Gurenge")).rejects.toThrow("rejected the request");
    expect(fromAnimeThemes).not.toHaveBeenCalled();
  });

  it("lets an AnimeThemes outage surface once it is the only source left", async () => {
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    fromAnimeThemes.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    await expect(searchSongEntries("Gurenge")).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("song search source clip filtering", () => {
  it("drops an AnisongDB (AMQ-hosted) result's URLs and reports clipBlocked under animethemes-only", async () => {
    clipSource.mockReturnValue("animethemes");
    const [result] = await searchSongEntries("Kaibutsu");
    expect(result).toMatchObject({ videoUrl: null, audioUrl: null, clipBlocked: true });
  });

  it("drops an AnimeThemes result's URLs and reports clipBlocked under anisongdb-only", async () => {
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    clipSource.mockReturnValue("anisongdb");
    const [result] = await searchSongEntries("Gurenge");
    expect(result).toMatchObject({ videoUrl: null, audioUrl: null, clipBlocked: true });
  });
});
