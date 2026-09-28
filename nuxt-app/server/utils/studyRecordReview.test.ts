import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, cardTrack, reviewLog, song } from "../db/schema.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { recordReview } from "./study.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

const DUE_AT = new Date("2026-09-01T00:00:00.000Z");
let cardId: number;

beforeEach(() => {
  const animeRow = upsertAnime({
    aniListId: 1, animethemesId: null, titleRomaji: "one", titleEnglish: null, titleNative: null,
    details: { year: 2005, season: null, format: "TV", averageScore: 70, genres: [], tags: [] },
  });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: "one", themeSlot: "OP1", animethemesThemeId: null });
  cardId = db.insert(card).values({
    songId: songRow.id, animethemesAudioUrl: "https://a.animethemes.moe/x.ogg", box: 1, streak: 2, nextReviewAt: DUE_AT,
  }).returning().get().id;
});

afterEach(() => {
  db.delete(reviewLog).run(); db.delete(cardTrack).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

function logRow(id: number) {
  return db.select().from(reviewLog).where(eq(reviewLog.id, id)).get()!;
}

describe("recordReview before-state", () => {
  it("logs the title track's streak and due date from before the review and returns the row id", () => {
    const result = recordReview(cardId, "pass");
    if (!("reviewLogId" in result)) throw new Error("expected a recorded review");

    const row = logRow(result.reviewLogId);
    expect(row).toMatchObject({ boxBefore: 1, streakBefore: 2, criterion: "title" });
    expect(row.nextReviewAtBefore).toEqual(DUE_AT);
    expect(result.card.streak).not.toBe(2);
  });

  it("logs an existing non-title track's own state, not the title track's", () => {
    const trackDue = new Date("2026-08-20T00:00:00.000Z");
    db.insert(cardTrack).values({ cardId, criterion: "song", box: 3, streak: 0, nextReviewAt: trackDue }).run();

    const result = recordReview(cardId, "fail", "song");
    if (!("reviewLogId" in result)) throw new Error("expected a recorded review");

    const row = logRow(result.reviewLogId);
    expect(row).toMatchObject({ boxBefore: 3, boxAfter: 1, streakBefore: 0, criterion: "song" });
    expect(row.nextReviewAtBefore).toEqual(trackDue);
  });

  it("logs a first-ever non-title review as a new, always-due track", () => {
    const result = recordReview(cardId, "pass", "song");
    if (!("reviewLogId" in result)) throw new Error("expected a recorded review");

    const row = logRow(result.reviewLogId);
    expect(row).toMatchObject({ boxBefore: 1, streakBefore: 0 });
    expect(row.nextReviewAtBefore).toEqual(new Date(0));
  });

  it("reports a missing card without logging anything", () => {
    expect(recordReview(cardId + 999, "pass")).toEqual({ notFound: true });
    expect(db.select().from(reviewLog).all()).toHaveLength(0);
  });
});
