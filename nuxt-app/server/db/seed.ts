import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.ts";
import { anime, artist, card, reviewLog, song } from "./schema.ts";

// Fixed, out-of-range id so this demo chain is always identifiable and this
// script can be re-run safely (it deletes its own rows first).
const DEMO_ANI_LIST_ID = 999_999_999;
const DEMO_ARTIST_NAME = "Kessoku Band (Demo)";

migrate(db, { migrationsFolder: "server/db/migrations" });

function clearPreviousRun() {
  const previousAnime = db.select().from(anime).where(eq(anime.aniListId, DEMO_ANI_LIST_ID)).get();
  if (previousAnime) {
    const previousSongs = db.select().from(song).where(eq(song.animeId, previousAnime.id)).all();
    const songIds = previousSongs.map((s) => s.id);
    if (songIds.length > 0) {
      const previousCards = db.select().from(card).where(inArray(card.songId, songIds)).all();
      const cardIds = previousCards.map((c) => c.id);
      if (cardIds.length > 0) {
        db.delete(card).where(inArray(card.id, cardIds)).run(); // cascades review_log
      }
      db.delete(song).where(inArray(song.id, songIds)).run();
    }
    db.delete(anime).where(eq(anime.id, previousAnime.id)).run();
  }
  db.delete(artist).where(eq(artist.name, DEMO_ARTIST_NAME)).run();
}

function seed() {
  const insertedArtist = db.insert(artist).values({ name: DEMO_ARTIST_NAME }).returning().get();

  const insertedAnime = db
    .insert(anime)
    .values({
      aniListId: DEMO_ANI_LIST_ID,
      titleEnglish: "Bocchi the Rock! (Demo)",
      titleRomaji: "Bocchi za Rokku! (Demo)",
      titleNative: "ぼっち・ざ・ろっく！（デモ）",
    })
    .returning()
    .get();

  const insertedSong = db
    .insert(song)
    .values({
      animeId: insertedAnime.id,
      artistId: insertedArtist.id,
      title: "Seishun Complex (Demo)",
      themeSlot: "OP1",
    })
    .returning()
    .get();

  const insertedCard = db
    .insert(card)
    .values({
      songId: insertedSong.id,
      animethemesVideoUrl: "https://v.animethemes.moe/demo-op1.webm",
    })
    .returning()
    .get();

  const insertedReviewLog = db
    .insert(reviewLog)
    .values({
      cardId: insertedCard.id,
      result: "pass",
      boxBefore: 1,
      boxAfter: 2,
    })
    .returning()
    .get();

  return { insertedArtist, insertedAnime, insertedSong, insertedCard, insertedReviewLog };
}

clearPreviousRun();
const result = seed();

console.log("Artist:    ", result.insertedArtist);
console.log("Anime:     ", result.insertedAnime);
console.log("Song:      ", result.insertedSong, "(artistId/animeId match above?",
  result.insertedSong.artistId === result.insertedArtist.id &&
    result.insertedSong.animeId === result.insertedAnime.id, ")");
console.log("Card:      ", result.insertedCard, "(songId matches above?",
  result.insertedCard.songId === result.insertedSong.id, ")");
console.log("ReviewLog: ", result.insertedReviewLog, "(cardId matches above?",
  result.insertedReviewLog.cardId === result.insertedCard.id, ")");
