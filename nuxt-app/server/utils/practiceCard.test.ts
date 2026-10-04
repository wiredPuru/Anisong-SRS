import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, card, reviewLog, song } from "../db/schema.ts";
import { getPracticeCard } from "./cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

afterEach(() => {
  db.delete(reviewLog).run(); db.delete(card).run(); db.delete(song).run(); db.delete(anime).run();
});

function addCard(aniListId: number, slot: string, extra: { suspended?: boolean } = {}): number {
  const animeRow = upsertAnime({ aniListId, animethemesId: null, titleRomaji: `A${aniListId}`, titleEnglish: null, titleNative: null });
  const songRow = upsertSong({ animeId: animeRow.id, artistId: getOrCreateArtist("Artist").id, title: slot, themeSlot: slot, animethemesThemeId: null });
  return db.insert(card).values({ songId: songRow.id, animethemesAudioUrl: "https://a/x.ogg", suspended: extra.suspended ?? false }).returning().get().id;
}

describe("getPracticeCard", () => {
  it("serves a card that is not due, oldest review first", () => {
    const future = new Date(Date.now() + 5 * 86_400_000);
    const older = addCard(1, "OP1");
    const newer = addCard(2, "OP1");
    db.update(card).set({ nextReviewAt: future }).run();
    db.insert(reviewLog).values([
      { cardId: older, result: "pass", boxBefore: 1, boxAfter: 2, reviewedAt: new Date(1_000_000) },
      { cardId: newer, result: "pass", boxBefore: 1, boxAfter: 2, reviewedAt: new Date(2_000_000) },
    ]).run();
    expect(getPracticeCard({ type: "all" })?.id).toBe(older);
  });

  it("leaves out suspended and buried cards", () => {
    const suspended = addCard(1, "OP1", { suspended: true });
    const buried = addCard(2, "OP1");
    const kept = addCard(3, "OP1");
    expect(suspended).not.toBe(kept);
    expect(getPracticeCard({ type: "all" }, "title", null, [], [buried])?.id).toBe(kept);
  });

  it("returns nothing when the scope has no cards", () => {
    expect(getPracticeCard({ type: "all" })).toBeUndefined();
  });
});
