import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, mediaLibrarySettings, song } from "../db/schema.ts";
import type { AnisongTheme } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { AnimeLookupUnavailableError } from "./animeMetadata.ts";
import type { ImportProgress } from "./importProgress.ts";
import {
  countCardsToRefresh,
  listSourceRefreshCandidates,
  matchTheme,
  refreshCardSources,
  type SourceRefreshCandidate,
  type SourceRefreshDeps,
} from "./cardSourceRefresh.ts";
import { isAnimethemesUrl } from "./clipSource.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const VIDEO = "https://v.animethemes.moe/BocchiTheRock-OP1.webm";
const AUDIO = "https://a.animethemes.moe/BocchiTheRock-OP1.ogg";
const AMQ_VIDEO = "https://naedist.animemusicquiz.com/byvisp.webm";
const AMQ_AUDIO = "https://naedist.animemusicquiz.com/qi299l.mp3";

// Inserted directly rather than through createCard: that validates a local path
// against the configured media library, which these rows only need to carry.
function makeCard(
  values: Partial<typeof card.$inferInsert> & { title?: string; themeSlot?: string; aniListId?: number } = {},
) {
  const { title = "Seishun Complex", themeSlot = "OP1", aniListId = 1, ...cardValues } = values;
  const animeRow = db.select().from(anime).where(eq(anime.aniListId, aniListId)).get()
    ?? db
      .insert(anime)
      .values({
        aniListId,
        titleEnglish: `Anime ${aniListId}`,
        titleRomaji: `Anime ${aniListId}`,
        titleNative: `Anime ${aniListId}`,
      })
      .returning()
      .get();
  const artistRow = db.select().from(artist).get()
    ?? db.insert(artist).values({ name: "Kessoku Band" }).returning().get();
  const songRow = db
    .insert(song)
    .values({ animeId: animeRow.id, artistId: artistRow.id, title, themeSlot })
    .returning()
    .get();

  return db.insert(card).values({ songId: songRow.id, ...cardValues }).returning().get();
}

const storedUrls = (id: number) => {
  const row = db.select().from(card).where(eq(card.id, id)).get()!;
  return { video: row.animethemesVideoUrl, audio: row.animethemesAudioUrl };
};

afterEach(() => {
  db.delete(card).run();
  db.delete(song).run();
  db.delete(artist).run();
  db.delete(anime).run();
  db.delete(mediaLibrarySettings).run();
});

describe("isAnimethemesUrl", () => {
  it("accepts the CDN subdomains a stored card actually uses", () => {
    expect(isAnimethemesUrl(VIDEO)).toBe(true);
    expect(isAnimethemesUrl(AUDIO)).toBe(true);
    expect(isAnimethemesUrl("https://animethemes.moe/clip.webm")).toBe(true);
  });

  it("rejects an AMQ host, a lookalike host, plain http, null and junk", () => {
    expect(isAnimethemesUrl(AMQ_VIDEO)).toBe(false);
    expect(isAnimethemesUrl("https://evil.com/animethemes.moe/clip.webm")).toBe(false);
    expect(isAnimethemesUrl("https://notanimethemes.moe/clip.webm")).toBe(false);
    expect(isAnimethemesUrl("http://v.animethemes.moe/clip.webm")).toBe(false);
    expect(isAnimethemesUrl(null)).toBe(false);
    expect(isAnimethemesUrl("v.animethemes.moe/clip.webm")).toBe(false);
  });
});

describe("listSourceRefreshCandidates", () => {
  it("flags both kinds on a card that streams both from animethemes.moe", () => {
    makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO });

    expect(listSourceRefreshCandidates()).toEqual([
      expect.objectContaining({ songTitle: "Seishun Complex", themeSlot: "OP1", swapVideo: true, swapAudio: true }),
    ]);
  });

  it("skips a kind that already has a local file", () => {
    makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO, localVideoPath: "/library/op1.webm" });

    expect(listSourceRefreshCandidates()).toEqual([
      expect.objectContaining({ swapVideo: false, swapAudio: true }),
    ]);
  });

  it("flags audio alone when that is the only animethemes.moe source", () => {
    makeCard({ animethemesAudioUrl: AUDIO });

    expect(listSourceRefreshCandidates()).toEqual([expect.objectContaining({ swapVideo: false, swapAudio: true })]);
  });

  it("ignores a card already served from AMQ", () => {
    makeCard({ animethemesVideoUrl: AMQ_VIDEO });

    expect(listSourceRefreshCandidates()).toEqual([]);
  });

  it("ignores a card with no remote source at all", () => {
    makeCard({ localVideoPath: "/library/op1.webm" });

    expect(listSourceRefreshCandidates()).toEqual([]);
  });

  it("ignores a host that merely spells animethemes.moe inside its path", () => {
    makeCard({ animethemesVideoUrl: "https://evil.com/animethemes.moe/clip.webm" });

    expect(listSourceRefreshCandidates()).toEqual([]);
  });

  it("carries the anime and song identity the run needs", () => {
    const row = makeCard({ animethemesVideoUrl: VIDEO, title: "Guitar to Kodoku to Aoi Hoshi", themeSlot: "ED3" });

    expect(listSourceRefreshCandidates()[0]).toEqual({
      cardId: row.id,
      animeId: expect.any(Number),
      aniListId: 1,
      songTitle: "Guitar to Kodoku to Aoi Hoshi",
      themeSlot: "ED3",
      swapVideo: true,
      swapAudio: false,
    });
  });
});

describe("listSourceRefreshCandidates clip source gate", () => {
  it("returns nothing under animethemes-only mode, even with real candidates present", () => {
    makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO });
    db.insert(mediaLibrarySettings).values({ id: 1, clipSource: "animethemes" }).run();

    expect(listSourceRefreshCandidates()).toEqual([]);
    expect(countCardsToRefresh()).toBe(0);
  });

  it.each(["anisongdb", "both"] as const)("still finds a candidate under %s mode (unchanged from today)", (source) => {
    makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO });
    db.insert(mediaLibrarySettings).values({ id: 1, clipSource: source }).run();

    expect(listSourceRefreshCandidates()).toHaveLength(1);
    expect(countCardsToRefresh()).toBe(1);
  });

  it("defaults to anisongdb (finds a candidate) when no setting row exists", () => {
    makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO });

    expect(listSourceRefreshCandidates()).toHaveLength(1);
  });
});

function candidate(songTitle: string, themeSlot = "OP1"): SourceRefreshCandidate {
  return { cardId: 1, animeId: 1, aniListId: 1, songTitle, themeSlot, swapVideo: true, swapAudio: true };
}

function theme(
  songTitle: string | null,
  themeSlot = "OP1",
  urls: Partial<Pick<AnisongTheme, "videoUrl" | "audioUrl">> = {},
): AnisongTheme {
  return { themeSlot, songTitle, artistName: null, videoUrl: AMQ_VIDEO, audioUrl: AMQ_AUDIO, ...urls };
}

describe("matchTheme", () => {
  it("never moves a card between an insert and an OP/ED sharing a song", () => {
    const insert = theme("Magia", "IN-500");
    const ed = theme("Magia", "ED2");

    expect(matchTheme(candidate("Magia", "ED2"), [insert])).toBeNull();
    expect(matchTheme(candidate("Magia", "IN-500"), [ed])).toBeNull();
    expect(matchTheme(candidate("Magia", "IN-500"), [ed, insert])).toBe(insert);
  });

  it("pairs on title even when the providers disagree on the slot", () => {
    const ed2 = theme("Kirakira", "ED2");

    expect(matchTheme(candidate("Kirakira", "ED1"), [theme("Wataridori", "ED1"), ed2])).toBe(ed2);
  });

  it("ignores case, punctuation and accents", () => {
    const match = theme("Déjà Vu!");

    expect(matchTheme(candidate("deja vu"), [match])).toBe(match);
  });

  it("refuses a real romanization difference rather than guessing", () => {
    expect(matchTheme(candidate("Kagami Hyoushi"), [theme("Kagamiutsushi")])).toBeNull();
  });

  it("breaks a same-title tie with the stored slot", () => {
    const op2 = theme("Rondo", "OP2");

    expect(matchTheme(candidate("Rondo", "OP2"), [theme("Rondo", "OP1"), op2])).toBe(op2);
  });

  it("gives up when two themes share a title and neither holds the stored slot", () => {
    expect(matchTheme(candidate("Rondo", "ED1"), [theme("Rondo", "OP1"), theme("Rondo", "OP2")])).toBeNull();
  });

  it("returns null for an empty theme list, an untitled theme, and an untitled card", () => {
    expect(matchTheme(candidate("Rondo"), [])).toBeNull();
    expect(matchTheme(candidate("Rondo"), [theme(null)])).toBeNull();
    expect(matchTheme(candidate("   "), [theme(null)])).toBeNull();
  });
});

const noReport = () => {};

function deps(overrides: Partial<SourceRefreshDeps> = {}): SourceRefreshDeps {
  return {
    fetchAnime: async () => ({ malId: 999 }),
    fetchThemes: async () => [theme("Seishun Complex")],
    ...overrides,
  };
}

describe("refreshCardSources", () => {
  it("moves both kinds to the AMQ host on a title match", async () => {
    const row = makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO });

    const result = await refreshCardSources(deps(), noReport);

    expect(storedUrls(row.id)).toEqual({ video: AMQ_VIDEO, audio: AMQ_AUDIO });
    expect(result).toEqual({ checked: 1, updated: 1, skipped: 0, animeUnavailable: 0 });
  });

  it("leaves a kind that already has a local file on its stored URL", async () => {
    const row = makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO, localAudioPath: "/library/op1.ogg" });

    await refreshCardSources(deps(), noReport);

    expect(storedUrls(row.id)).toEqual({ video: AMQ_VIDEO, audio: AUDIO });
  });

  it("leaves a kind the matched theme has no URL for", async () => {
    const row = makeCard({ animethemesVideoUrl: VIDEO, animethemesAudioUrl: AUDIO });

    await refreshCardSources(
      deps({ fetchThemes: async () => [theme("Seishun Complex", "OP1", { audioUrl: null })] }),
      noReport,
    );

    expect(storedUrls(row.id)).toEqual({ video: AMQ_VIDEO, audio: AUDIO });
  });

  it("writes nothing for a card no theme matches", async () => {
    const row = makeCard({ animethemesVideoUrl: VIDEO });

    const result = await refreshCardSources(deps({ fetchThemes: async () => [theme("Totally Different")] }), noReport);

    expect(storedUrls(row.id).video).toBe(VIDEO);
    expect(result).toEqual({ checked: 1, updated: 0, skipped: 1, animeUnavailable: 0 });
  });

  it("skips an anime with no MAL id without asking AnisongDB", async () => {
    makeCard({ animethemesVideoUrl: VIDEO });
    const fetchThemes = vi.fn(async () => [theme("Seishun Complex")]);

    const result = await refreshCardSources(deps({ fetchAnime: async () => ({ malId: null }), fetchThemes }), noReport);

    expect(fetchThemes).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, updated: 0, skipped: 1, animeUnavailable: 0 });
  });

  it("skips an anime AniList has no record for", async () => {
    makeCard({ animethemesVideoUrl: VIDEO });

    const result = await refreshCardSources(deps({ fetchAnime: async () => null }), noReport);

    expect(result).toEqual({ checked: 1, updated: 0, skipped: 1, animeUnavailable: 0 });
  });

  it("keeps going when AniList is unavailable for one anime", async () => {
    const blocked = makeCard({ aniListId: 1, animethemesVideoUrl: VIDEO });
    const reached = makeCard({ aniListId: 2, animethemesVideoUrl: VIDEO });

    const result = await refreshCardSources(
      deps({
        fetchAnime: async (aniListId) => {
          if (aniListId === 1) throw new ProviderUnavailableError("AniList");
          return { malId: 2 };
        },
      }),
      noReport,
    );

    expect(storedUrls(blocked.id).video).toBe(VIDEO);
    expect(storedUrls(reached.id).video).toBe(AMQ_VIDEO);
    expect(result).toEqual({ checked: 2, updated: 1, skipped: 1, animeUnavailable: 1 });
  });

  it("stops the whole run when AnisongDB is unavailable", async () => {
    const row = makeCard({ aniListId: 1, animethemesVideoUrl: VIDEO });
    makeCard({ aniListId: 2, animethemesVideoUrl: VIDEO });
    const fetchAnime = vi.fn(async () => ({ malId: 999 }));

    await expect(
      refreshCardSources(
        deps({ fetchAnime, fetchThemes: async () => { throw new ProviderUnavailableError("AnisongDB"); } }),
        noReport,
      ),
    ).rejects.toThrow(ProviderUnavailableError);

    expect(fetchAnime).toHaveBeenCalledTimes(1);
    expect(storedUrls(row.id).video).toBe(VIDEO);
  });

  it("reports an outage rather than a successful no-op when nothing could be reached", async () => {
    makeCard({ animethemesVideoUrl: VIDEO });

    await expect(
      refreshCardSources(
        deps({ fetchAnime: async () => { throw new ProviderUnavailableError("AniList"); } }),
        noReport,
      ),
    ).rejects.toThrow(AnimeLookupUnavailableError);
  });

  it("waits out a rate limit and retries that anime", async () => {
    const row = makeCard({ animethemesVideoUrl: VIDEO });
    const fetchAnime = vi.fn()
      .mockRejectedValueOnce(new ProviderUnavailableError("AniList", 20))
      .mockResolvedValueOnce({ malId: 999 });
    const reports: ImportProgress[] = [];

    const result = await refreshCardSources(deps({ fetchAnime }), (progress) => reports.push(progress));

    expect(fetchAnime).toHaveBeenCalledTimes(2);
    expect(storedUrls(row.id).video).toBe(AMQ_VIDEO);
    expect(result).toEqual({ checked: 1, updated: 1, skipped: 0, animeUnavailable: 0 });
    expect(reports.map((entry) => entry.label)).toContain("Waiting out AniList's rate limit");
  });

  it("does not wait on an outage that sends no Retry-After", async () => {
    makeCard({ animethemesVideoUrl: VIDEO });
    const fetchAnime = vi.fn().mockRejectedValue(new ProviderUnavailableError("AniList"));

    await expect(refreshCardSources(deps({ fetchAnime }), noReport)).rejects.toThrow(AnimeLookupUnavailableError);

    expect(fetchAnime).toHaveBeenCalledTimes(1);
  });

  it("stops waiting once the per-run cap is spent", async () => {
    for (let aniListId = 1; aniListId <= 11; aniListId += 1) makeCard({ aniListId, animethemesVideoUrl: VIDEO });
    const fetchAnime = vi.fn().mockRejectedValue(new ProviderUnavailableError("AniList", 1));

    await expect(refreshCardSources(deps({ fetchAnime }), noReport)).rejects.toThrow(AnimeLookupUnavailableError);

    // 10 anime get one wait and one retry each; the 11th is refused outright.
    expect(fetchAnime).toHaveBeenCalledTimes(21);
  });

  it("asks AnisongDB once per anime, not once per card, and reports progress per anime", async () => {
    makeCard({ aniListId: 1, themeSlot: "OP1", title: "Seishun Complex", animethemesVideoUrl: VIDEO });
    makeCard({ aniListId: 1, themeSlot: "OP2", title: "Distortion!!", animethemesVideoUrl: VIDEO });
    const fetchThemes = vi.fn(async () => [theme("Seishun Complex", "OP1"), theme("Distortion!!", "OP2")]);
    const reports: ImportProgress[] = [];

    const result = await refreshCardSources(deps({ fetchThemes }), (progress) => reports.push(progress));

    expect(fetchThemes).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ checked: 2, updated: 2, skipped: 0, animeUnavailable: 0 });
    expect(reports).toEqual([
      { label: "Re-resolving clip sources", completed: 0, total: 1, unavailable: 0 },
      { label: "Re-resolving clip sources", completed: 1, total: 1, unavailable: 0 },
    ]);
  });
});

describe("refreshCardSources scoped to cardIds", () => {
  it("lists and rewrites only the named card, calling providers for its anime alone", async () => {
    const target = makeCard({ animethemesVideoUrl: VIDEO, aniListId: 1 });
    const other = makeCard({ animethemesVideoUrl: VIDEO, aniListId: 2, title: "Seishun Complex" });
    const fetchAnime = vi.fn(async () => ({ malId: 999 }));
    const fetchThemes = vi.fn(async () => [theme("Seishun Complex")]);

    expect(listSourceRefreshCandidates([target.id]).map((c) => c.cardId)).toEqual([target.id]);

    const result = await refreshCardSources(deps({ fetchAnime, fetchThemes }), noReport, [target.id]);

    expect(result).toEqual({ checked: 1, updated: 1, skipped: 0, animeUnavailable: 0 });
    expect(fetchAnime).toHaveBeenCalledTimes(1);
    expect(fetchAnime).toHaveBeenCalledWith(1);
    expect(storedUrls(target.id).video).toBe(AMQ_VIDEO);
    expect(storedUrls(other.id).video).toBe(VIDEO);
  });

  it("checks nothing and calls no provider for a card that is not a candidate", async () => {
    const local = makeCard({ animethemesVideoUrl: VIDEO, localVideoPath: "/library/op1.webm" });
    const fetchAnime = vi.fn(async () => ({ malId: 999 }));

    const result = await refreshCardSources(deps({ fetchAnime }), noReport, [local.id]);

    expect(result).toEqual({ checked: 0, updated: 0, skipped: 0, animeUnavailable: 0 });
    expect(fetchAnime).not.toHaveBeenCalled();
  });

  it("covers the whole library when no filter is given", () => {
    makeCard({ animethemesVideoUrl: VIDEO, aniListId: 1 });
    makeCard({ animethemesVideoUrl: VIDEO, aniListId: 2 });

    expect(listSourceRefreshCandidates()).toHaveLength(2);
  });
});

describe("countCardsToRefresh", () => {
  it("counts exactly the rows the run would touch", () => {
    makeCard({ animethemesVideoUrl: VIDEO, themeSlot: "OP1" });
    makeCard({ animethemesAudioUrl: AUDIO, themeSlot: "OP2" });
    makeCard({ animethemesVideoUrl: AMQ_VIDEO, themeSlot: "ED1" });
    makeCard({ animethemesVideoUrl: VIDEO, localVideoPath: "/library/ed2.webm", themeSlot: "ED2" });

    expect(countCardsToRefresh()).toBe(2);
    expect(countCardsToRefresh()).toBe(listSourceRefreshCandidates().length);
  });
});
