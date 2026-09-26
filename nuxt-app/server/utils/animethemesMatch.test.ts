import { describe, expect, it, vi } from "vitest";
import { backfillAnimeThemesMatches, type MatchCandidate } from "./animethemesMatch.ts";
import type { AnimeThemesMatchIndex } from "./themeSource.ts";

const checkedAt = new Date("2026-09-21T00:00:00.000Z");

const candidate = (overrides: Partial<MatchCandidate> = {}): MatchCandidate => ({
  songId: 1,
  animeId: 71,
  aniListId: 195,
  songTitle: "LOVE A RIDDLE",
  themeSlot: "OP1",
  ...overrides,
});

const indexOf = (titles: Record<string, number>, videoSlugs: Record<number, string> = {}): AnimeThemesMatchIndex => ({
  status: "ok",
  animethemesId: 1502,
  animethemesSlug: "onegai_teacher",
  byTitle: new Map(Object.entries(titles)),
  videoSlugByThemeId: new Map(Object.entries(videoSlugs).map(([id, slug]) => [Number(id), slug])),
});
const noVideo = { animethemesSlug: "onegai_teacher", animethemesVideoSlug: null };

function run(candidates: MatchCandidate[], indexes: Record<number, AnimeThemesMatchIndex>) {
  const store = vi.fn();
  const loadIndexes = (ids: number[]) => new Map(ids.map((id) => [id, Promise.resolve(indexes[id]!)]));
  return backfillAnimeThemesMatches(candidates, { loadIndexes, store, now: () => checkedAt })
    .then((result) => ({ result, store }));
}

describe("backfillAnimeThemesMatches", () => {
  it("stores the theme id AnimeThemes has for the song", async () => {
    const { result, store } = await run([candidate()], { 195: indexOf({ "loveariddle": 1633 }, { 1633: "ED1-NCDVD480" }) });
    expect(store).toHaveBeenCalledWith(candidate(), 1633, checkedAt, {
      animethemesSlug: "onegai_teacher",
      animethemesVideoSlug: "ED1-NCDVD480",
    });
    expect(result).toEqual({ checked: 1, matched: 1, missing: 0, unavailable: 0 });
  });

  it("stamps a song AnimeThemes genuinely does not have, so it is not probed again", async () => {
    const { result, store } = await run([candidate()], { 195: indexOf({}) });
    expect(store).toHaveBeenCalledWith(candidate(), null, checkedAt, noVideo);
    expect(result).toEqual({ checked: 1, matched: 0, missing: 1, unavailable: 0 });
  });

  it("leaves a song unstamped when AnimeThemes could not be reached", async () => {
    const { result, store } = await run([candidate()], { 195: { status: "unavailable" } });
    expect(store).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, matched: 0, missing: 0, unavailable: 1 });
  });

  it("stamps an insert as checked without borrowing an OP/ED's match", async () => {
    const { result, store } = await run(
      [candidate({ themeSlot: "IN-21049" })],
      { 195: indexOf({ "loveariddle": 1633 }) },
    );

    expect(store.mock.calls.map(([, themeId, at]) => [themeId, at])).toEqual([[null, checkedAt]]);
    expect(result).toMatchObject({ checked: 1, matched: 0, missing: 1 });
  });

  it("checks every song of an anime against that anime's single lookup", async () => {
    const loadIndexes = vi.fn((ids: number[]) =>
      new Map(ids.map((id) => [id, Promise.resolve(indexOf({ "loveariddle": 1633 }))])));
    const store = vi.fn();
    const result = await backfillAnimeThemesMatches(
      [candidate(), candidate({ songId: 2, songTitle: "Not On AnimeThemes" })],
      { loadIndexes, store, now: () => checkedAt },
    );

    expect(loadIndexes).toHaveBeenCalledWith([195, 195]);
    expect(store.mock.calls.map(([stored, themeId, at, links]) => [stored.songId, themeId, at, links])).toEqual([
      [1, 1633, checkedAt, noVideo],
      [2, null, checkedAt, noVideo],
    ]);
    expect(result).toMatchObject({ checked: 2, matched: 1, missing: 1 });
  });

  it("reports progress per song", async () => {
    const report = vi.fn();
    const loadIndexes = (ids: number[]) => new Map(ids.map((id) => [id, Promise.resolve(indexOf({}))]));
    await backfillAnimeThemesMatches([candidate(), candidate({ songId: 2 })], {
      loadIndexes,
      store: vi.fn(),
      report,
      now: () => checkedAt,
    });

    expect(report.mock.calls.map(([progress]) => progress.completed)).toEqual([1, 2]);
    expect(report).toHaveBeenLastCalledWith(expect.objectContaining({ total: 2 }));
  });
});
