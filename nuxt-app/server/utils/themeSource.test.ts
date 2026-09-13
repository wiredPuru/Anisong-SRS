import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRequestError, ProviderUnavailableError } from "../lib/graphql.ts";
import { fetchAnimeThemesByAniListId } from "../lib/animethemes.ts";
import { fetchThemesByMalId } from "../lib/anisongdb.ts";
import { resolveThemes } from "./themeSource.ts";

vi.mock("../lib/animethemes.ts", () => ({ fetchAnimeThemesByAniListId: vi.fn() }));
vi.mock("../lib/anisongdb.ts", () => ({ fetchThemesByMalId: vi.fn() }));

const fromAnimeThemes = vi.mocked(fetchAnimeThemesByAniListId);
const fromAnisong = vi.mocked(fetchThemesByMalId);

const animethemesTheme = (overrides = {}) => ({
  animethemesThemeId: 900,
  themeSlot: "OP1",
  songTitle: "Tank!",
  songTitleNative: "タンク!",
  artistName: "Seatbelts",
  videoUrl: "https://v.animethemes.moe/slow.webm",
  audioUrl: "https://a.animethemes.moe/slow.ogg",
  ...overrides,
});

const anisongTheme = (overrides = {}) => ({
  themeSlot: "OP1",
  songTitle: "Tank!",
  artistName: "Seatbelts",
  videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
  audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
  ...overrides,
});

const resolve = (malId: number | null = 1) => resolveThemes({ aniListId: 1, malId });

beforeEach(() => {
  fromAnimeThemes.mockReset();
  fromAnisong.mockReset();
  fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [animethemesTheme()] });
  fromAnisong.mockResolvedValue([anisongTheme()]);
});

describe("theme source resolution", () => {
  it("starts the AnisongDB request without waiting on AnimeThemes", async () => {
    let release!: () => void;
    fromAnimeThemes.mockImplementation(() => new Promise((resolved) => {
      release = () => resolved({ animethemesId: 521, themes: [animethemesTheme()] });
    }));
    const pending = resolve();
    await Promise.resolve();
    expect(fromAnisong).toHaveBeenCalled();
    release();
    await expect(pending).resolves.toMatchObject({ animethemesId: 521 });
  });

  it("merges a slot both providers know about", async () => {
    expect(await resolve()).toEqual({
      animethemesId: 521,
      themes: [{
        themeSlot: "OP1",
        songTitle: "Tank!",
        songTitleNative: "タンク!",
        artistName: "Seatbelts",
        videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
        audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
        animethemesThemeId: 900,
        source: "merged",
      }],
    });
    expect(fromAnisong).toHaveBeenCalledWith(1, 1);
  });

  it("keeps AnimeThemes titles on a merge so a re-import cannot rewrite stored metadata", async () => {
    fromAnisong.mockResolvedValue([anisongTheme({ songTitle: "TANK !!", artistName: "The Seatbelts" })]);
    expect((await resolve()).themes[0]).toMatchObject({ songTitle: "Tank!", artistName: "Seatbelts", songTitleNative: "タンク!" });
  });

  it("falls back per kind when AnisongDB lacks one", async () => {
    fromAnisong.mockResolvedValue([anisongTheme({ videoUrl: null })]);
    expect((await resolve()).themes[0]).toMatchObject({
      videoUrl: "https://v.animethemes.moe/slow.webm",
      audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
    });
  });

  it("keeps a song only one provider knows about, from whichever has it", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [animethemesTheme({ themeSlot: "ED1", songTitle: "Blue" })] });
    fromAnisong.mockResolvedValue([anisongTheme({ themeSlot: "OP1", songTitle: "Tank!" })]);
    expect((await resolve()).themes).toEqual([
      expect.objectContaining({ themeSlot: "ED1", songTitle: "Blue", source: "animethemes" }),
      expect.objectContaining({ themeSlot: "OP1", songTitle: "Tank!", source: "anisongdb", songTitleNative: null, animethemesThemeId: null }),
    ]);
  });

  it("pairs on song title, not slot, when the two providers number a slot differently", async () => {
    // Real case: BanG Dream! Ave Mujica. AnimeThemes ED1 is AnisongDB's Ending 2.
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [
      animethemesTheme({ themeSlot: "ED1", songTitle: "Georgette Me, Georgette You", animethemesThemeId: 901 }),
      animethemesTheme({ themeSlot: "ED2", songTitle: "Crucifix X", animethemesThemeId: 902 }),
    ] });
    fromAnisong.mockResolvedValue([
      anisongTheme({ themeSlot: "ED1", songTitle: "Bankuruwase", videoUrl: "https://naedist.animemusicquiz.com/wrong.webm" }),
      anisongTheme({ themeSlot: "ED2", songTitle: "Georgette Me, Georgette You", videoUrl: "https://naedist.animemusicquiz.com/right.webm" }),
    ]);
    const { themes } = await resolve();
    expect(themes).toEqual([
      expect.objectContaining({ themeSlot: "ED1", songTitle: "Georgette Me, Georgette You", videoUrl: "https://naedist.animemusicquiz.com/right.webm", source: "merged" }),
      expect.objectContaining({ themeSlot: "ED2", songTitle: "Crucifix X", videoUrl: "https://v.animethemes.moe/slow.webm", source: "animethemes" }),
    ]);
  });

  it("does not add an unpaired AnisongDB song over a slot AnimeThemes already claims", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [animethemesTheme({ themeSlot: "ED1", songTitle: "Crucifix X" })] });
    fromAnisong.mockResolvedValue([anisongTheme({ themeSlot: "ED1", songTitle: "Bankuruwase" })]);
    expect((await resolve()).themes).toEqual([
      expect.objectContaining({ themeSlot: "ED1", songTitle: "Crucifix X", videoUrl: "https://v.animethemes.moe/slow.webm", source: "animethemes" }),
    ]);
  });

  it.each([
    ["punctuation and case", "TANK!!"],
    ["spacing", "Tank !"],
    ["accents", "Tánk!"],
  ])("still pairs across a %s difference", async (_label, songTitle) => {
    fromAnisong.mockResolvedValue([anisongTheme({ songTitle })]);
    expect((await resolve()).themes[0]).toMatchObject({ songTitle: "Tank!", source: "merged", videoUrl: "https://naedist.animemusicquiz.com/fast.webm" });
  });

  it("leaves a genuinely different romanization on AnimeThemes rather than guessing", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [animethemesTheme({ songTitle: "Kagami Hyoushi" })] });
    fromAnisong.mockResolvedValue([anisongTheme({ songTitle: "Kagamiutsushi" })]);
    expect((await resolve()).themes[0]).toMatchObject({ songTitle: "Kagami Hyoushi", videoUrl: "https://v.animethemes.moe/slow.webm", source: "animethemes" });
  });

  it("uses AnimeThemes alone when AnisongDB is unavailable", async () => {
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    expect((await resolve()).themes).toEqual([expect.objectContaining({ source: "animethemes", videoUrl: "https://v.animethemes.moe/slow.webm" })]);
  });

  it("uses AnisongDB alone when AnimeThemes is unavailable", async () => {
    fromAnimeThemes.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    expect(await resolve()).toEqual({
      animethemesId: null,
      themes: [expect.objectContaining({ source: "anisongdb", videoUrl: "https://naedist.animemusicquiz.com/fast.webm" })],
    });
  });

  it("surfaces the outage when both are unavailable, rather than an empty theme list", async () => {
    fromAnimeThemes.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    await expect(resolve()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("does not swallow a non-availability fault behind a degraded import", async () => {
    fromAnisong.mockRejectedValue(new ProviderRequestError("AnisongDB rejected the request (422)."));
    await expect(resolve()).rejects.toThrow("rejected the request");
  });

  it("skips AnisongDB entirely when the anime has no MAL id", async () => {
    expect((await resolve(null)).themes).toEqual([expect.objectContaining({ source: "animethemes" })]);
    expect(fromAnisong).not.toHaveBeenCalled();
  });

  it("returns an empty list when neither provider has the anime", async () => {
    fromAnimeThemes.mockResolvedValue(null);
    fromAnisong.mockResolvedValue([]);
    expect(await resolve()).toEqual({ animethemesId: null, themes: [] });
  });
});
