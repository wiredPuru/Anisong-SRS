import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import {
  backfillAnimeThemesLinks,
  countAnimeMissingLinks,
  listLinkCandidates,
  storeAnimeLinks,
  type LinkCandidate,
} from "./animethemesLinkBackfill.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import type { AnimeThemesMatchIndex } from "./themeSource.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

afterEach(() => {
  db.delete(card).run(); db.delete(song).run(); db.delete(artist).run(); db.delete(anime).run();
});

type OkIndex = Extract<AnimeThemesMatchIndex, { status: "ok" }>;

const indexOf = (animethemesId: number | null, videoSlugs: Record<number, string> = {}): OkIndex => ({
  status: "ok",
  animethemesId,
  animethemesSlug: animethemesId === null ? null : "bocchi_the_rock",
  byTitle: new Map(),
  videoSlugByThemeId: new Map(Object.entries(videoSlugs).map(([id, slug]) => [Number(id), slug])),
});

function run(candidates: LinkCandidate[], indexes: Record<number, AnimeThemesMatchIndex>) {
  const store = vi.fn();
  const loadIndexes = (ids: number[]) => new Map(ids.map((id) => [id, Promise.resolve(indexes[id]!)]));
  return backfillAnimeThemesLinks(candidates, { loadIndexes, store }).then((result) => ({ result, store }));
}

describe("backfillAnimeThemesLinks", () => {
  const candidate = { animeId: 7, aniListId: 130003 };

  it("stores the links AnimeThemes returns for an anime", async () => {
    const index = indexOf(2157, { 900: "OP1-NCBD1080" });
    const { result, store } = await run([candidate], { 130003: index });
    expect(store).toHaveBeenCalledWith(candidate, index);
    expect(result).toEqual({ checked: 1, filled: 1, notFound: 0, unavailable: 0 });
  });

  it("counts an anime AnimeThemes no longer returns as not found, writing nothing", async () => {
    const { result, store } = await run([candidate], { 130003: indexOf(null) });
    expect(store).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, filled: 0, notFound: 1, unavailable: 0 });
  });

  it("writes nothing on an outage, so the next run retries", async () => {
    const { result, store } = await run([candidate], { 130003: { status: "unavailable" } });
    expect(store).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, filled: 0, notFound: 0, unavailable: 1 });
  });

  it("reports progress per anime", async () => {
    const report = vi.fn();
    const loadIndexes = (ids: number[]) => new Map(ids.map((id) => [id, Promise.resolve(indexOf(null))]));
    await backfillAnimeThemesLinks([candidate, { animeId: 8, aniListId: 2 }], { loadIndexes, store: vi.fn(), report });
    expect(report.mock.calls.map(([progress]) => progress.completed)).toEqual([1, 2]);
  });
});

describe("link backfill candidates and storage", () => {
  function seed(aniListId: number, animethemesId: number | null, songs: { slot: string; themeId: number | null; withCard?: boolean }[]) {
    const row = upsertAnime({ aniListId, animethemesId, titleRomaji: `Anime ${aniListId}`, titleEnglish: null, titleNative: null });
    const performer = getOrCreateArtist("Kessoku Band");
    const songRows = songs.map(({ slot, themeId, withCard = true }) => {
      const songRow = upsertSong({ animeId: row.id, artistId: performer.id, title: slot, themeSlot: slot, animethemesThemeId: themeId });
      if (withCard) db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg" }).run();
      return songRow;
    });
    return { row, songRows };
  }

  it("lists card-backed anime AnimeThemes has, missing either slug", () => {
    seed(1, 501, [{ slot: "OP1", themeId: 901 }]);
    const missingVideo = seed(2, 502, [{ slot: "OP1", themeId: 902 }]);
    db.update(anime).set({ animethemesSlug: "has_slug" }).where(eq(anime.id, missingVideo.row.id)).run();
    seed(3, null, [{ slot: "OP1", themeId: null }]);
    seed(4, 504, [{ slot: "OP1", themeId: 904, withCard: false }]);
    const complete = seed(5, 505, [{ slot: "OP1", themeId: 905 }, { slot: "ED1", themeId: null }]);
    db.update(anime).set({ animethemesSlug: "done" }).where(eq(anime.id, complete.row.id)).run();
    db.update(song).set({ animethemesVideoSlug: "OP1" }).where(eq(song.id, complete.songRows[0]!.id)).run();

    expect(listLinkCandidates().map((c) => c.aniListId).sort()).toEqual([1, 2]);
    expect(countAnimeMissingLinks()).toBe(2);
  });

  it("stores the anime slug and matching songs' video slugs, then drops out of the candidates", () => {
    const { row, songRows } = seed(1, 501, [{ slot: "OP1", themeId: 901 }, { slot: "ED1", themeId: 902 }]);
    storeAnimeLinks({ animeId: row.id, aniListId: 1 }, indexOf(501, { 901: "OP1-NCBD1080", 902: "ED1" }));

    expect(db.select().from(anime).get()!.animethemesSlug).toBe("bocchi_the_rock");
    expect(db.select().from(song).all().map((s) => [s.id, s.animethemesVideoSlug]))
      .toEqual([[songRows[0]!.id, "OP1-NCBD1080"], [songRows[1]!.id, "ED1"]]);
    expect(countAnimeMissingLinks()).toBe(0);
  });

  it("leaves an anime a candidate when AnimeThemes has no video for one of its songs", () => {
    const { row } = seed(1, 501, [{ slot: "OP1", themeId: 901 }, { slot: "ED1", themeId: 902 }]);
    storeAnimeLinks({ animeId: row.id, aniListId: 1 }, indexOf(501, { 901: "OP1" }));
    expect(countAnimeMissingLinks()).toBe(1);
  });
});
