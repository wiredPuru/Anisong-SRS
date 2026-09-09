import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, mediaLibrarySettings, song } from "../db/schema.ts";
import { updateCard } from "./cards.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

let folder: string;
let audioPath: string;
let cardId: number;

function snapshot() {
  return {
    anime: db.select().from(anime).all(),
    artists: db.select().from(artist).all(),
    songs: db.select().from(song).all(),
    cards: db.select().from(card).all(),
  };
}

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), "gaq-card-edit-"));
  audioPath = join(folder, "theme.mp3");
  writeFileSync(audioPath, "test audio");
  const show = db.insert(anime).values({ aniListId: 1, titleRomaji: "Show", titleEnglish: "Show", titleNative: "作品" }).returning().get();
  const singer = db.insert(artist).values({ name: "Original artist" }).returning().get();
  const theme = db.insert(song).values({ animeId: show.id, artistId: singer.id, title: "Original song", themeSlot: "OP1" }).returning().get();
  const otherTheme = db.insert(song).values({ animeId: show.id, artistId: singer.id, title: "Another song", themeSlot: "ED1" }).returning().get();
  cardId = db.insert(card).values({ songId: theme.id, localAudioPath: audioPath }).returning().get().id;
  db.insert(card).values({ songId: otherTheme.id, animethemesAudioUrl: "https://example.com/other.ogg" }).run();
  db.insert(mediaLibrarySettings).values({ id: 1, libraryPaths: [folder] }).run();
});

afterEach(() => {
  db.run(sql`DROP TRIGGER IF EXISTS reject_card_update`);
  db.delete(card).run();
  db.delete(song).run();
  db.delete(artist).run();
  db.delete(anime).run();
  db.delete(mediaLibrarySettings).run();
  rmSync(folder, { recursive: true, force: true });
});

describe("updateCard atomic edits", () => {
  it.each(["rename", "reassign"] as const)("preserves all metadata when a %s edit has an invalid local path", (artistMode) => {
    const before = snapshot();
    expect(updateCard({ id: cardId, artistMode, artistName: "Changed artist", songTitle: "Changed song", themeSlot: "OP2", notes: "Changed notes", localVideoPath: join(folder, "missing.webm") })).toEqual({ error: "Local file does not exist." });
    expect(snapshot()).toEqual(before);
    expect(existsSync(audioPath)).toBe(true);
  });

  it("preserves metadata and the audio file when clearing the only source is rejected", () => {
    const before = snapshot();
    expect(updateCard({ id: cardId, artistMode: "rename", artistName: "Changed artist", songTitle: "Changed song", localAudioPath: null })).toEqual({ error: "Card needs at least one video or audio source." });
    expect(snapshot()).toEqual(before);
    expect(existsSync(audioPath)).toBe(true);
  });

  it.each(["rename", "reassign"] as const)("rolls back %s and song writes if the final card write fails", (artistMode) => {
    const before = snapshot();
    db.run(sql`CREATE TRIGGER reject_card_update BEFORE UPDATE ON card BEGIN SELECT RAISE(ABORT, 'forced card update failure'); END`);
    expect(() => updateCard({ id: cardId, artistMode, artistName: "Changed artist", songTitle: "Changed song", notes: "Changed notes" })).toThrow();
    expect(snapshot()).toEqual(before);
    expect(existsSync(audioPath)).toBe(true);
  });

  it("commits a valid rename and edit, preserving shared-artist semantics", () => {
    const result = updateCard({ id: cardId, artistMode: "rename", artistName: " Changed artist ", songTitle: " Changed song ", notes: " New note " });
    expect(result).toMatchObject({ card: { artistName: "Changed artist", songTitle: "Changed song", notes: "New note" } });
    expect(db.select().from(artist).all()).toHaveLength(1);
    expect(new Set(db.select().from(song).all().map((row) => row.artistId)).size).toBe(1);
  });

  it("commits reassignment without renaming the other song's artist", () => {
    expect(updateCard({ id: cardId, artistMode: "reassign", artistName: "New artist" })).toMatchObject({ card: { artistName: "New artist" } });
    expect(db.select().from(artist).all().map((row) => row.name)).toEqual(["Original artist", "New artist"]);
    expect(new Set(db.select().from(song).all().map((row) => row.artistId)).size).toBe(2);
  });

  it("deletes cleared media only after the transaction commits", () => {
    db.update(card).set({ animethemesAudioUrl: "https://example.com/theme.ogg" }).where(eq(card.id, cardId)).run();
    const before = snapshot();
    db.run(sql`CREATE TRIGGER reject_card_update BEFORE UPDATE ON card BEGIN SELECT RAISE(ABORT, 'forced card update failure'); END`);
    expect(() => updateCard({ id: cardId, songTitle: "Changed song", localAudioPath: null })).toThrow();
    expect(snapshot()).toEqual(before);
    expect(existsSync(audioPath)).toBe(true);

    db.run(sql`DROP TRIGGER reject_card_update`);
    expect(updateCard({ id: cardId, songTitle: "Changed song", localAudioPath: null })).toMatchObject({ card: { songTitle: "Changed song", localAudioPath: null } });
    expect(existsSync(audioPath)).toBe(false);
  });
});
