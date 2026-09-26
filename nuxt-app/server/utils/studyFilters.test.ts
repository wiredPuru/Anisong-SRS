import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, song } from "../db/schema.ts";
import type { AniListDetails } from "../lib/anilist.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { parseStudyFilters, studyFilterCondition, type StudyFilters } from "./studyFilters.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const EMPTY: StudyFilters = {
  yearMin: null, yearMax: null, seasons: [], scoreMin: null, scoreMax: null, formats: [], themeTypes: [],
  genresInclude: [], genresExclude: [], tagsInclude: [], tagsExclude: [], tagMinRank: 60,
  listAniListIds: null, listSource: null,
};
const SOURCE = { site: "anilist" as const, username: "Kyoto", fetchedAt: "2026-09-25T00:00:00.000Z" };

function parse(value: Partial<StudyFilters> | string) {
  return parseStudyFilters(typeof value === "string" ? value : JSON.stringify(value));
}

describe("parseStudyFilters", () => {
  it("treats a missing or empty filter set as no filtering", () => {
    expect(parseStudyFilters(undefined)).toEqual({ filters: null });
    expect(parseStudyFilters("")).toEqual({ filters: null });
    expect(parse({})).toEqual({ filters: null });
    expect(parse({ ...EMPTY, tagMinRank: 80 })).toEqual({ filters: null });
  });

  it("accepts seasons on their own, de-duplicated, as an active filter", () => {
    expect(parse({ seasons: ["SPRING", "FALL", "SPRING"] })).toEqual({ filters: { ...EMPTY, seasons: ["SPRING", "FALL"] } });
  });

  it("fills defaults for missing fields and de-duplicates lists", () => {
    expect(parse({ yearMin: 2000, genresInclude: ["Comedy", "Comedy"] })).toEqual({
      filters: { ...EMPTY, yearMin: 2000, genresInclude: ["Comedy"] },
    });
  });

  it.each([
    ["{", "not valid JSON"],
    ["[]", "JSON object"],
    [{ yearMin: 1850 }, "yearMin"],
    [{ yearMax: 2000.5 }, "yearMax"],
    [{ scoreMin: -1 }, "scoreMin"],
    [{ scoreMax: "90" }, "scoreMax"],
    [{ yearMin: 2010, yearMax: 2000 }, "yearMin must not be after"],
    [{ scoreMin: 80, scoreMax: 70 }, "scoreMin must not be above"],
    [{ formats: ["CARTOON"] }, "unknown value"],
    [{ themeTypes: ["XX"] }, "unknown value"],
    [{ seasons: ["AUTUMN"] }, "unknown value"],
    [{ seasons: "SPRING" }, "list"],
    [{ genresInclude: "Comedy" }, "list"],
    [{ tagsInclude: Array.from({ length: 51 }, (_, i) => `t${i}`) }, "at most 50"],
    [{ tagsExclude: ["x".repeat(101)] }, "at most 100 characters"],
    [{ genresExclude: [""] }, "non-empty"],
    [{ tagMinRank: 101 }, "tagMinRank"],
  ] as const)("rejects %o", (input, message) => {
    const result = parse(input as Partial<StudyFilters> | string);
    expect(result).toHaveProperty("error");
    expect((result as { error: string }).error).toContain(message);
  });

  it("accepts a list with its source, trimming the username, and treats it as active even when empty", () => {
    expect(parse({ listAniListIds: [5, 5, 7], listSource: { ...SOURCE, username: " Kyoto " } })).toEqual({
      filters: { ...EMPTY, listAniListIds: [5, 7], listSource: SOURCE },
    });
    expect(parse({ listAniListIds: [], listSource: SOURCE })).toEqual({ filters: { ...EMPTY, listAniListIds: [], listSource: SOURCE } });
  });

  it.each([
    [{ listAniListIds: [1] }, "set together"],
    [{ listSource: SOURCE }, "set together"],
    [{ listAniListIds: [0], listSource: SOURCE }, "AniList ids"],
    [{ listAniListIds: ["1"], listSource: SOURCE }, "AniList ids"],
    [{ listAniListIds: Array.from({ length: 5001 }, (_, i) => i + 1), listSource: SOURCE }, "at most 5000"],
    [{ listAniListIds: [1], listSource: { ...SOURCE, site: "kitsu" } }, "listSource"],
    [{ listAniListIds: [1], listSource: { ...SOURCE, username: "  " } }, "listSource"],
    [{ listAniListIds: [1], listSource: { ...SOURCE, username: "x".repeat(101) } }, "listSource"],
  ] as const)("rejects list fields %o", (input, message) => {
    expect((parse(input as unknown as Partial<StudyFilters>) as { error: string }).error).toContain(message);
  });

  it("rejects a non-string raw value", () => {
    expect(parseStudyFilters(["a"])).toEqual({ error: "filters must be a JSON string" });
  });
});

describe("studyFilterCondition", () => {
  const cards: Record<string, number> = {};

  function addAnime(key: string, slot: string, details?: Partial<AniListDetails>) {
    const animeRow = upsertAnime({
      aniListId: Object.keys(cards).length + 1, animethemesId: null, titleRomaji: key, titleEnglish: null, titleNative: null,
      details: details ? { year: null, format: null, averageScore: null, genres: [], tags: [], ...details } : undefined,
    });
    const artistRow = getOrCreateArtist("Artist");
    const songRow = upsertSong({ animeId: animeRow.id, artistId: artistRow.id, title: key, themeSlot: slot, animethemesThemeId: null });
    cards[key] = db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg" }).returning().get().id;
  }

  function matching(filters: Partial<StudyFilters>) {
    return db
      .select({ id: card.id, title: song.title })
      .from(card)
      .innerJoin(song, eq(card.songId, song.id))
      .innerJoin(anime, eq(song.animeId, anime.id))
      .where(studyFilterCondition({ ...EMPTY, ...filters }))
      .all()
      .map((row) => row.title)
      .sort();
  }

  beforeEach(() => {
    addAnime("kon", "OP1", { year: 2009, format: "TV", averageScore: 78, genres: ["Comedy", "Music", "Slice of Life"], tags: [{ name: "Cute Girls Doing Cute Things", rank: 96 }] });
    addAnime("azumanga", "ED1", { year: 2002, format: "TV", averageScore: 80, genres: ["Comedy", "Slice of Life"], tags: [{ name: "Cute Girls Doing Cute Things", rank: 40 }] });
    addAnime("eva", "OP1", { year: 1995, format: "TV", averageScore: 83, genres: ["Action", "Drama", "Mecha"], tags: [{ name: "Ecchi", rank: 20 }] });
    addAnime("movie", "ED1", { year: 2016, format: "MOVIE", averageScore: null, genres: ["Drama", "Romance"], tags: [] });
    addAnime("unknown", "OP1");
  });

  afterEach(() => {
    db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
    for (const key of Object.keys(cards)) delete cards[key];
  });

  it("returns no condition for no filters", () => {
    expect(studyFilterCondition(null)).toBeUndefined();
  });

  it("filters by year range, dropping unknown years", () => {
    expect(matching({ yearMin: 2000, yearMax: 2010 })).toEqual(["azumanga", "kon"]);
    expect(matching({ yearMax: 1999 })).toEqual(["eva"]);
  });

  it("filters by score, dropping unknown scores", () => {
    expect(matching({ scoreMin: 80 })).toEqual(["azumanga", "eva"]);
    expect(matching({ scoreMax: 79 })).toEqual(["kon"]);
  });

  it("filters by format and theme type", () => {
    expect(matching({ formats: ["MOVIE"] })).toEqual(["movie"]);
    expect(matching({ themeTypes: ["OP"] })).toEqual(["eva", "kon", "unknown"]);
    expect(matching({ themeTypes: ["OP", "ED"] })).toHaveLength(5);
    addAnime("madoka", "IN-21049");
    expect(matching({ themeTypes: ["IN"] })).toEqual(["madoka"]);
    expect(matching({ themeTypes: ["OP", "IN"] })).toEqual(["eva", "kon", "madoka", "unknown"]);
  });

  it("requires every included genre and none of the excluded ones", () => {
    expect(matching({ genresInclude: ["Comedy", "Music"] })).toEqual(["kon"]);
    expect(matching({ genresExclude: ["Drama"] })).toEqual(["azumanga", "kon", "unknown"]);
  });

  it("matches tags only at or above the minimum rank, for include and exclude", () => {
    expect(matching({ tagsInclude: ["Cute Girls Doing Cute Things"] })).toEqual(["kon"]);
    expect(matching({ tagsInclude: ["Cute Girls Doing Cute Things"], tagMinRank: 30 })).toEqual(["azumanga", "kon"]);
    expect(matching({ tagsExclude: ["Ecchi"] })).toHaveLength(5);
    expect(matching({ tagsExclude: ["Ecchi"], tagMinRank: 10 })).not.toContain("eva");
  });

  it("keeps only anime on the user's list, and nothing for an empty list", () => {
    const aniListIdOf = (key: string) => db.select({ id: anime.aniListId }).from(anime).where(eq(anime.titleRomaji, key)).get()!.id;
    expect(matching({ listAniListIds: [aniListIdOf("kon"), aniListIdOf("eva")], listSource: SOURCE })).toEqual(["eva", "kon"]);
    expect(matching({ listAniListIds: [], listSource: SOURCE })).toEqual([]);
  });

  it("combines filters, as in cute-girls shows from the 2000s", () => {
    expect(matching({ yearMin: 2000, yearMax: 2009, tagsInclude: ["Cute Girls Doing Cute Things"], tagMinRank: 30, themeTypes: ["ED"] })).toEqual(["azumanga"]);
  });
});
