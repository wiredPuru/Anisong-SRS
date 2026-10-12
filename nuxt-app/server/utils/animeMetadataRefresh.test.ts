import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, cardTrack, deck, deckCard, reviewLog, song } from "../db/schema.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { refreshAnimeMetadata } from "./animeMetadataRefresh.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const details = { year: 2020, season: "SPRING" as const, format: "TV", averageScore: 85, popularity: 100, genres: ["Comedy"], tags: [{ name: "Music", rank: 90 }] };
const fresh = { aniListId: 101, malId: 88, titleRomaji: "Updated", titleEnglish: "Updated EN", titleNative: "更新", coverImageUrl: "updated.jpg", details };
const fetchAnime = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T13:00:00Z"));
  fetchAnime.mockReset().mockResolvedValue(fresh);
});
afterEach(() => {
  db.delete(deckCard).run(); db.delete(deck).run(); db.delete(cardTrack).run(); db.delete(reviewLog).run();
  db.delete(card).run(); db.delete(song).run(); db.delete(artist).run(); db.delete(anime).run();
  vi.useRealTimers();
});

function seedAnime() {
  return upsertAnime({ aniListId: 101, animethemesId: 501, animethemesSlug: "old-slug", titleRomaji: "Stored", titleEnglish: "Stored EN", titleNative: "保存", coverImageUrl: "old.jpg" });
}

describe("explicit anime metadata refresh", () => {
  it.each([undefined, null, "1", 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid ID %s before fetching", async (id) => {
    await expect(refreshAnimeMetadata(id, fetchAnime)).rejects.toMatchObject({ statusCode: 400 });
    expect(fetchAnime).not.toHaveBeenCalled();
  });

  it("does not query a provider for a missing saved row", async () => {
    await expect(refreshAnimeMetadata(999, fetchAnime)).rejects.toMatchObject({ statusCode: 404 });
    expect(fetchAnime).not.toHaveBeenCalled();
  });

  it("updates only the selected anime metadata while preserving local content and study data", async () => {
    const stored = seedAnime();
    db.update(anime).set({ coverImagePath: "stored.png" }).where(eq(anime.id, stored.id)).run();
    const other = upsertAnime({ aniListId: 202, animethemesId: null, titleRomaji: "Other", titleEnglish: null, titleNative: null });
    const savedSong = upsertSong({ animeId: stored.id, artistId: getOrCreateArtist("Singer").id, title: "Opening", themeSlot: "OP1", animethemesThemeId: 9 });
    const savedCard = db.insert(card).values({ songId: savedSong.id, localVideoPath: "/library/clip.webm", notes: "Keep me", box: 4, streak: 3 }).returning().get();
    const savedTrack = db.insert(cardTrack).values({ cardId: savedCard.id, criterion: "artist", box: 3 }).returning().get();
    const savedReview = db.insert(reviewLog).values({ cardId: savedCard.id, result: "pass", boxBefore: 3, boxAfter: 4 }).returning().get();
    const savedDeck = db.insert(deck).values({ name: "Favorites" }).returning().get();
    const membership = db.insert(deckCard).values({ deckId: savedDeck.id, cardId: savedCard.id }).returning().get();
    expect(await refreshAnimeMetadata(stored.id, fetchAnime)).toEqual({ animeId: stored.id, aniListId: 101, refreshedAt: "2026-10-12T13:00:00.000Z" });
    expect(fetchAnime).toHaveBeenCalledExactlyOnceWith(101);
    expect(db.select().from(anime).where(eq(anime.id, stored.id)).get()).toEqual({ ...stored, ...details, titleRomaji: "Updated", titleEnglish: "Updated EN", titleNative: "更新", coverImageUrl: "updated.jpg", coverImagePath: "stored.png", aniListDetailsCheckedAt: new Date("2026-10-12T13:00:00Z") });
    expect(db.select().from(anime).where(eq(anime.id, other.id)).get()).toEqual(other);
    expect(db.select().from(song).all()).toEqual([savedSong]);
    expect(db.select().from(card).all()).toEqual([savedCard]);
    expect(db.select().from(cardTrack).all()).toEqual([savedTrack]);
    expect(db.select().from(reviewLog).all()).toEqual([savedReview]);
    expect(db.select().from(deck).all()).toEqual([savedDeck]);
    expect(db.select().from(deckCard).all()).toEqual([membership]);
  });

  it.each([null, { ...fresh, aniListId: 202 }, { ...fresh, details: undefined }])("keeps the saved row unchanged for unusable response %j", async (response) => {
    const stored = seedAnime();
    fetchAnime.mockResolvedValue(response);
    await expect(refreshAnimeMetadata(stored.id, fetchAnime)).rejects.toMatchObject({ statusCode: response === null ? 404 : 503 });
    expect(db.select().from(anime).all()).toEqual([stored]);
  });

  it.each([new ProviderUnavailableError("AniList"), new Error("Rejected query")])("keeps the saved row unchanged when fetching fails (%s)", async (error) => {
    const stored = seedAnime();
    fetchAnime.mockRejectedValue(error);
    await expect(refreshAnimeMetadata(stored.id, fetchAnime)).rejects.toBe(error);
    expect(db.select().from(anime).all()).toEqual([stored]);
  });

  it("does not recreate an anime deleted while the provider request was pending", async () => {
    const stored = seedAnime();
    fetchAnime.mockImplementation(async () => {
      db.delete(anime).where(eq(anime.id, stored.id)).run();
      return fresh;
    });
    await expect(refreshAnimeMetadata(stored.id, fetchAnime)).rejects.toMatchObject({ statusCode: 404 });
    expect(db.select().from(anime).all()).toEqual([]);
  });

  it("keeps existing title fallback conventions when AniList has no translated titles", async () => {
    const stored = seedAnime();
    fetchAnime.mockResolvedValue({ ...fresh, titleEnglish: null, titleNative: null });
    await refreshAnimeMetadata(stored.id, fetchAnime);
    expect(db.select().from(anime).where(eq(anime.id, stored.id)).get()).toMatchObject({ titleEnglish: fresh.titleRomaji, titleNative: fresh.titleRomaji });
  });
});
