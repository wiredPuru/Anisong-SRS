import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

export const anime = sqliteTable("anime", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  aniListId: integer("ani_list_id").notNull().unique(),
  animethemesId: integer("animethemes_id"),
  titleEnglish: text("title_english").notNull(),
  titleRomaji: text("title_romaji").notNull(),
  titleNative: text("title_native").notNull(),
  coverImageUrl: text("cover_image_url"),
});

export const artist = sqliteTable("artist", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const song = sqliteTable(
  "song",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    animeId: integer("anime_id")
      .notNull()
      .references(() => anime.id),
    artistId: integer("artist_id")
      .notNull()
      .references(() => artist.id),
    title: text("title").notNull(),
    titleNative: text("title_native"),
    themeSlot: text("theme_slot").notNull(),
    animethemesThemeId: integer("animethemes_theme_id"),
  },
  (table) => [unique("song_anime_theme_slot_unique").on(table.animeId, table.themeSlot)],
);

export const card = sqliteTable("card", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  songId: integer("song_id")
    .notNull()
    .references(() => song.id),
  localVideoPath: text("local_video_path"),
  localAudioPath: text("local_audio_path"),
  animethemesVideoUrl: text("animethemes_video_url"),
  animethemesAudioUrl: text("animethemes_audio_url"),
  box: integer("box").notNull().default(1),
  streak: integer("streak").notNull().default(0),
  nextReviewAt: integer("next_review_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const reviewLog = sqliteTable("review_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cardId: integer("card_id")
    .notNull()
    .references(() => card.id, { onDelete: "cascade" }),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  result: text("result").notNull().$type<"pass" | "fail">(),
  boxBefore: integer("box_before").notNull(),
  boxAfter: integer("box_after").notNull(),
});

export const deck = sqliteTable("deck", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const deckCard = sqliteTable(
  "deck_card",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    deckId: integer("deck_id")
      .notNull()
      .references(() => deck.id, { onDelete: "cascade" }),
    cardId: integer("card_id")
      .notNull()
      .references(() => card.id, { onDelete: "cascade" }),
  },
  (table) => [unique("deck_card_unique").on(table.deckId, table.cardId)],
);

export const mediaLibrarySettings = sqliteTable("media_library_settings", {
  id: integer("id").primaryKey(),
  libraryPaths: text("library_paths", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  defaultDownloadFolder: text("default_download_folder"),
  dailyNewCardLimit: integer("daily_new_card_limit"),
  boxOneStreakRequired: integer("box_one_streak_required").notNull().default(3),
  streamCacheMaxBytes: integer("stream_cache_max_bytes").notNull().default(1_073_741_824),
  playbackMode: text("playback_mode").$type<"auto" | "audioOnly">().notNull().default("auto"),
});

export type Anime = typeof anime.$inferSelect;
export type NewAnime = typeof anime.$inferInsert;

export type Artist = typeof artist.$inferSelect;
export type NewArtist = typeof artist.$inferInsert;

export type Song = typeof song.$inferSelect;
export type NewSong = typeof song.$inferInsert;

export type Card = typeof card.$inferSelect;
export type NewCard = typeof card.$inferInsert;

export type ReviewLog = typeof reviewLog.$inferSelect;
export type NewReviewLog = typeof reviewLog.$inferInsert;

export type MediaLibrarySettings = typeof mediaLibrarySettings.$inferSelect;
export type NewMediaLibrarySettings = typeof mediaLibrarySettings.$inferInsert;

export type Deck = typeof deck.$inferSelect;
export type NewDeck = typeof deck.$inferInsert;

export type DeckCard = typeof deckCard.$inferSelect;
export type NewDeckCard = typeof deckCard.$inferInsert;
