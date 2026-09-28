import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, card, cardTrack, reviewLog, song } from "../db/schema.ts";
import { getNewCardsTodayInfo } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { recordReview } from "./study.ts";
import { UNDO_NOT_LATEST_MESSAGE, UNDO_PRE_FEATURE_MESSAGE, parseUndoBody, undoReview } from "./studyUndo.ts";

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

function reviewed(result: ReturnType<typeof recordReview>) {
  if (!("reviewLogId" in result)) throw new Error("expected a recorded review");
  return result.reviewLogId;
}

function cardRow() {
  return db.select().from(card).where(eq(card.id, cardId)).get()!;
}

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

describe("undoReview", () => {
  it("restores the title track's box, streak, and due date and deletes the log row", () => {
    const logId = reviewed(recordReview(cardId, "pass"));
    expect(cardRow().box).toBe(2);

    const result = undoReview(logId);
    expect(result).toHaveProperty("card");
    expect(cardRow()).toMatchObject({ box: 1, streak: 2, nextReviewAt: DUE_AT });
    expect(db.select().from(reviewLog).all()).toHaveLength(0);
  });

  it("restores an existing non-title track to its earlier state", () => {
    const trackDue = new Date("2026-08-20T00:00:00.000Z");
    db.insert(cardTrack).values({ cardId, criterion: "song", box: 3, streak: 0, nextReviewAt: trackDue }).run();
    const earlier = reviewed(recordReview(cardId, "pass", "song"));
    const logId = reviewed(recordReview(cardId, "fail", "song"));

    undoReview(logId);
    const track = db.select().from(cardTrack).where(eq(cardTrack.cardId, cardId)).get()!;
    expect(track.box).toBe(4);
    expect(db.select().from(reviewLog).all().map((row) => row.id)).toEqual([earlier]);
  });

  it("removes a non-title track row created by the review being undone", () => {
    const logId = reviewed(recordReview(cardId, "pass", "song"));
    expect(db.select().from(cardTrack).all()).toHaveLength(1);

    undoReview(logId);
    expect(db.select().from(cardTrack).all()).toHaveLength(0);
    expect(cardRow()).toMatchObject({ box: 1, streak: 2 });
  });

  it("refuses a review that is not the latest for its track", () => {
    const first = reviewed(recordReview(cardId, "pass"));
    reviewed(recordReview(cardId, "fail"));
    expect(undoReview(first)).toEqual({ conflict: UNDO_NOT_LATEST_MESSAGE });
  });

  it("does not let another track's later review block an undo", () => {
    const titleLog = reviewed(recordReview(cardId, "pass"));
    reviewed(recordReview(cardId, "pass", "song"));
    expect(undoReview(titleLog)).toHaveProperty("card");
  });

  it("refuses a review logged before its prior state was recorded", () => {
    const logId = db.insert(reviewLog).values({ cardId, result: "pass", boxBefore: 1, boxAfter: 2 }).returning().get().id;
    expect(undoReview(logId)).toEqual({ conflict: UNDO_PRE_FEATURE_MESSAGE });
  });

  it("reports a missing review", () => {
    expect(undoReview(9999)).toEqual({ notFound: true });
  });

  it("gives back a new card's slot in today's new-card count", () => {
    db.update(card).set({ box: 1, streak: 0 }).where(eq(card.id, cardId)).run();
    const before = getNewCardsTodayInfo().introduced;
    const logId = reviewed(recordReview(cardId, "pass"));
    expect(getNewCardsTodayInfo().introduced).toBe(before + 1);

    undoReview(logId);
    expect(getNewCardsTodayInfo().introduced).toBe(before);
  });
});

describe("parseUndoBody", () => {
  it("accepts a positive integer id", () => {
    expect(parseUndoBody({ reviewLogId: 7 })).toEqual({ reviewLogId: 7 });
  });

  it.each([null, undefined, "7", {}, { reviewLogId: "7" }, { reviewLogId: 0 }, { reviewLogId: -1 }, { reviewLogId: 1.5 }])(
    "rejects %j",
    (body) => {
      expect(parseUndoBody(body)).toHaveProperty("error");
    },
  );
});
