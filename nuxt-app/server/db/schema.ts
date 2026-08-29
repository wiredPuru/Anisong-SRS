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
});

// No unique constraint on (scopeType, scopeId): SQLite treats every NULL as
// distinct in a unique index, which would let duplicate "all" rows (scopeId
// null) slip through. One-row-per-scope is enforced in application code
// instead (see getScopeMode/setScopeMode).
export const studyScopeSetting = sqliteTable("study_scope_setting", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  scopeType: text("scope_type").notNull().$type<"artist" | "anime" | "all">(),
  scopeId: integer("scope_id"),
  mode: text("mode").notNull().default("auto").$type<"auto" | "audioOnly" | "videoOnly">(),
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
