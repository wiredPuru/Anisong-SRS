import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderRequestError, ProviderUnavailableError } from "../lib/graphql.ts";
import { fetchAnimeThemesByAniListId, fetchThemeTitlesByAniListIds } from "../lib/animethemes.ts";
import { fetchThemesByMalId } from "../lib/anisongdb.ts";
import {
  findThemeMatch,
  isMissingAnimeThemesMatch,
  loadAnimeThemesMatchIndex,
  matchLinkSlugs,
  resolveThemes,
  startMatchIndexLoads,
} from "./themeSource.ts";

vi.mock("../lib/animethemes.ts", () => ({ fetchAnimeThemesByAniListId: vi.fn(), fetchThemeTitlesByAniListIds: vi.fn() }));
vi.mock("../lib/anisongdb.ts", () => ({ fetchThemesByMalId: vi.fn() }));

const fromAnimeThemes = vi.mocked(fetchAnimeThemesByAniListId);
const titlesFromAnimeThemes = vi.mocked(fetchThemeTitlesByAniListIds);
const fromAnisong = vi.mocked(fetchThemesByMalId);

const animethemesTheme = (overrides = {}) => ({
  animethemesThemeId: 900,
  themeSlot: "OP1",
  songTitle: "Tank!",
  songTitleNative: "タンク!",
  artistName: "Seatbelts",
  videoUrl: "https://v.animethemes.moe/slow.webm",
  audioUrl: "https://a.animethemes.moe/slow.ogg",
  animethemesVideoSlug: "OP1",
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
  titlesFromAnimeThemes.mockReset();
  fromAnimeThemes.mockResolvedValue({ animethemesId: 521, animethemesSlug: "cowboy_bebop", themes: [animethemesTheme()] });
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
      animethemesSlug: "cowboy_bebop",
      animethemesUnavailable: false,
      themes: [{
        themeSlot: "OP1",
        songTitle: "Tank!",
        songTitleNative: "タンク!",
        artistName: "Seatbelts",
        videoUrl: "https://naedist.animemusicquiz.com/fast.webm",
        audioUrl: "https://naedist.animemusicquiz.com/fast.mp3",
        animethemesThemeId: 900,
        animethemesVideoSlug: "OP1",
        source: "merged",
      }],
    });
    expect(fromAnisong).toHaveBeenCalledWith(1, 1, { includeInserts: false });
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
      expect.objectContaining({
        themeSlot: "OP1",
        songTitle: "Tank!",
        source: "anisongdb",
        songTitleNative: null,
        animethemesThemeId: null,
        animethemesVideoSlug: null,
      }),
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
      animethemesSlug: null,
      animethemesUnavailable: true,
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
    expect(await resolve()).toEqual({ animethemesId: null, animethemesSlug: null, animethemesUnavailable: false, themes: [] });
  });

  it("does not report AnimeThemes as unavailable when it simply has no entry for the anime", async () => {
    fromAnimeThemes.mockResolvedValue(null);
    expect((await resolve()).animethemesUnavailable).toBe(false);
  });

  it("does not report AnimeThemes as unavailable when only AnisongDB is down", async () => {
    fromAnisong.mockRejectedValue(new ProviderUnavailableError("AnisongDB"));
    expect((await resolve()).animethemesUnavailable).toBe(false);
  });
});

describe("insert songs in theme resolution", () => {
  it("keeps an insert apart from an AnimeThemes ED with the same title", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, animethemesSlug: "madoka", themes: [
      animethemesTheme({ themeSlot: "ED2", songTitle: "Magia", animethemesThemeId: 902 }),
    ] });
    fromAnisong.mockResolvedValue([
      anisongTheme({ themeSlot: "IN-500", songTitle: "Magia", videoUrl: "https://naedist.animemusicquiz.com/insert.webm" }),
    ]);

    const { themes } = await resolve();
    expect(themes).toEqual([
      expect.objectContaining({ themeSlot: "ED2", animethemesThemeId: 902, videoUrl: "https://v.animethemes.moe/slow.webm", source: "animethemes" }),
      expect.objectContaining({ themeSlot: "IN-500", animethemesThemeId: null, videoUrl: "https://naedist.animemusicquiz.com/insert.webm", source: "anisongdb" }),
    ]);
  });
});

describe("AnimeThemes match index", () => {
  const load = () => loadAnimeThemesMatchIndex(1);

  it("never matches an insert slot, even on an exact title", async () => {
    expect(findThemeMatch(await load(), "Tank!", "IN-21049")).toBeNull();
  });

  it.each([
    ["exactly", "Tank!"],
    ["across case and punctuation", "TANK!!"],
    ["across spacing", "Tank !"],
    ["across accents", "Tánk!"],
  ])("matches a song title %s", async (_label, songTitle) => {
    expect(findThemeMatch(await load(), songTitle, "OP1")).toBe(900);
  });

  it("finds a match regardless of which slot the asking provider labels it", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [animethemesTheme({ themeSlot: "ED1", songTitle: "Crucifix X", animethemesThemeId: 902 })] });
    expect(findThemeMatch(await load(), "Crucifix X", "OP1")).toBe(902);
  });

  it("does not guess across a real spelling difference", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [animethemesTheme({ songTitle: "Kagami Hyoushi" })] });
    expect(findThemeMatch(await load(), "Kagamiutsushi", "OP1")).toBeNull();
  });

  it("keeps the first theme when two share a title", async () => {
    fromAnimeThemes.mockResolvedValue({ animethemesId: 521, themes: [
      animethemesTheme({ themeSlot: "OP1", animethemesThemeId: 900 }),
      animethemesTheme({ themeSlot: "ED1", animethemesThemeId: 901 }),
    ] });
    expect(findThemeMatch(await load(), "Tank!", "OP1")).toBe(900);
  });

  it("returns null for a blank or missing title", async () => {
    const index = await load();
    expect(findThemeMatch(index, null, "OP1")).toBeNull();
    expect(findThemeMatch(index, "  !! ", "OP1")).toBeNull();
  });

  it("returns an ok index with nothing in it when AnimeThemes has no entry for the anime", async () => {
    fromAnimeThemes.mockResolvedValue(null);
    const index = await load();
    expect(index).toEqual({ status: "ok", animethemesId: null, animethemesSlug: null, byTitle: new Map(), videoSlugByThemeId: new Map() });
    expect(findThemeMatch(index, "Tank!", "OP1")).toBeNull();
  });

  it("reports an outage as unavailable instead of throwing", async () => {
    fromAnimeThemes.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    const index = await load();
    expect(index).toEqual({ status: "unavailable" });
    expect(findThemeMatch(index, "Tank!", "OP1")).toBeNull();
  });

  it("rethrows a fault that is not an outage", async () => {
    fromAnimeThemes.mockRejectedValue(new ProviderRequestError("AnimeThemes rejected the request (422)."));
    await expect(load()).rejects.toThrow("rejected the request");
  });
});

describe("missing AnimeThemes match gate", () => {
  it("is not missing when a theme id is stored", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: 900, unavailable: false })).toBe(false);
  });

  it("is missing when no id is stored and AnimeThemes was reachable", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: null, unavailable: false })).toBe(true);
  });

  it("fails open when no id is stored but AnimeThemes was unreachable", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: null, unavailable: true })).toBe(false);
  });

  it("stays not missing when an id is stored even during an outage", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: 900, unavailable: true })).toBe(false);
  });
});

describe("bulk match index loading", () => {
  const start = (ids: number[], options = {}) => startMatchIndexLoads(ids, { retryDelayMs: 0, ...options });
  const titles = (id: number, songTitle = "Tank!") => [id, { animethemesId: 500 + id, themes: [{ animethemesThemeId: 900 + id, songTitle }] }] as const;
  // Answers every requested id with a one-song anime, like AnimeThemes would.
  beforeEach(() => {
    titlesFromAnimeThemes.mockImplementation(async (ids: number[]) => new Map(ids.map((id) => titles(id))));
  });

  it("returns one promise per distinct anime, keyed by AniList id", async () => {
    const loads = start([1, 2, 2, 3]);
    expect([...loads.keys()]).toEqual([1, 2, 3]);
    await Promise.all(loads.values());
  });

  it("asks for a whole chunk of anime in one request, not one request each", async () => {
    await Promise.all(start(Array.from({ length: 70 }, (_, i) => i + 1), { chunkSize: 40 }).values());
    expect(titlesFromAnimeThemes.mock.calls.map(([ids]) => ids.length)).toEqual([40, 30]);
    expect(fromAnimeThemes).not.toHaveBeenCalled();
  });

  it("builds each anime's own index from its own themes", async () => {
    titlesFromAnimeThemes.mockResolvedValue(new Map([titles(1, "Tank!"), titles(2, "Blue")]));
    const loads = start([1, 2]);
    expect(findThemeMatch(await loads.get(1)!, "Tank!", "OP1")).toBe(901);
    expect(findThemeMatch(await loads.get(1)!, "Blue", "OP1")).toBeNull();
    expect(findThemeMatch(await loads.get(2)!, "Blue", "OP1")).toBe(902);
  });

  it("carries link slugs into the index, and matchLinkSlugs reads them back", async () => {
    titlesFromAnimeThemes.mockResolvedValue(new Map([[1, {
      animethemesId: 501,
      animethemesSlug: "cowboy_bebop",
      themes: [{ animethemesThemeId: 901, songTitle: "Tank!", animethemesVideoSlug: "OP1-NCBD1080" }],
    }]]));
    const index = await start([1]).get(1)!;
    expect(matchLinkSlugs(index, findThemeMatch(index, "Tank!", "OP1"))).toEqual({ animethemesSlug: "cowboy_bebop", animethemesVideoSlug: "OP1-NCBD1080" });
    expect(matchLinkSlugs(index, null)).toEqual({ animethemesSlug: "cowboy_bebop", animethemesVideoSlug: null });
    expect(matchLinkSlugs({ status: "unavailable" }, 901)).toEqual({ animethemesSlug: null, animethemesVideoSlug: null });
  });

  it("gives an anime AnimeThemes has no entry for an ok index with nothing in it", async () => {
    titlesFromAnimeThemes.mockResolvedValue(new Map([titles(1)]));
    const missing = await start([1, 2]).get(2)!;
    expect(missing).toEqual({ status: "ok", animethemesId: null, animethemesSlug: null, byTitle: new Map(), videoSlugByThemeId: new Map() });
  });

  it("never runs more requests at once than the concurrency bound", async () => {
    let inFlight = 0;
    let peak = 0;
    titlesFromAnimeThemes.mockImplementation(async (ids: number[]) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return new Map(ids.map((id) => titles(id)));
    });
    await Promise.all(start([1, 2, 3, 4, 5, 6, 7], { chunkSize: 1, concurrency: 2 }).values());
    expect(peak).toBe(2);
    expect(titlesFromAnimeThemes).toHaveBeenCalledTimes(7);
  });

  it("retries an outage once and uses the retry's answer", async () => {
    titlesFromAnimeThemes
      .mockRejectedValueOnce(new ProviderUnavailableError("AnimeThemes"))
      .mockImplementationOnce(async (ids: number[]) => new Map(ids.map((id) => titles(id))));
    expect((await start([1]).get(1)!).status).toBe("ok");
    expect(titlesFromAnimeThemes).toHaveBeenCalledTimes(2);
  });

  it("reports unavailable when the retry is also an outage", async () => {
    titlesFromAnimeThemes.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    await expect(start([1, 2]).get(1)!).resolves.toEqual({ status: "unavailable" });
    expect(titlesFromAnimeThemes).toHaveBeenCalledTimes(2);
  });

  it("stops calling the provider once several chunks in a row stay unavailable", async () => {
    titlesFromAnimeThemes.mockRejectedValue(new ProviderUnavailableError("AnimeThemes"));
    const results = await Promise.all(start([1, 2, 3, 4, 5], { chunkSize: 1, concurrency: 1, giveUpAfter: 2 }).values());
    expect(results.every((index) => index.status === "unavailable")).toBe(true);
    expect(titlesFromAnimeThemes).toHaveBeenCalledTimes(4);
  });

  it("does not let one recovered chunk trip the give-up threshold", async () => {
    titlesFromAnimeThemes
      .mockRejectedValueOnce(new ProviderUnavailableError("AnimeThemes"))
      .mockRejectedValueOnce(new ProviderUnavailableError("AnimeThemes"))
      .mockImplementation(async (ids: number[]) => new Map(ids.map((id) => titles(id))));
    const results = await Promise.all(start([1, 2, 3, 4], { chunkSize: 1, concurrency: 1, giveUpAfter: 2 }).values());
    expect(results.map((index) => index.status)).toEqual(["unavailable", "ok", "ok", "ok"]);
  });

  it("hands a non-outage fault to the anime in that chunk, and to no other chunk", async () => {
    titlesFromAnimeThemes
      .mockRejectedValueOnce(new ProviderRequestError("AnimeThemes rejected the request (422)."))
      .mockImplementation(async (ids: number[]) => new Map(ids.map((id) => titles(id))));
    const loads = start([1, 2], { chunkSize: 1, concurrency: 1 });
    await expect(loads.get(1)!).rejects.toThrow("rejected the request");
    await expect(loads.get(2)!).resolves.toMatchObject({ status: "ok" });
  });

  it("does not raise an unhandled rejection for a failed load nobody awaits", async () => {
    titlesFromAnimeThemes.mockRejectedValue(new ProviderRequestError("AnimeThemes rejected the request (422)."));
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    start([1]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
});

describe("missing AnimeThemes match gate", () => {
  it("is not missing when a theme id is stored", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: 900, unavailable: false })).toBe(false);
  });

  it("is missing when no id is stored and AnimeThemes was reachable", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: null, unavailable: false })).toBe(true);
  });

  it("fails open when no id is stored but AnimeThemes was unreachable", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: null, unavailable: true })).toBe(false);
  });

  it("stays not missing when an id is stored even during an outage", () => {
    expect(isMissingAnimeThemesMatch({ storedThemeId: 900, unavailable: true })).toBe(false);
  });
});
