import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime, artist, card, mediaLibrarySettings, song } from "../db/schema.ts";
import type { DeckBundleManifest } from "./deckExport.ts";
import { importBundle } from "./deckImport.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

let bundleDir: string;

function writeManifest(manifest: DeckBundleManifest) {
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(join(bundleDir, "manifest.json"), JSON.stringify(manifest));
}

function baseEntry(overrides: Partial<DeckBundleManifest["cards"][number]> = {}): DeckBundleManifest["cards"][number] {
  return {
    anime: { aniListId: 1, animethemesId: null, titleEnglish: "Show", titleRomaji: "Show", titleNative: "作品" },
    artistName: "Original artist",
    song: { title: "Original song", themeSlot: "OP1", animethemesThemeId: null },
    animethemesVideoUrl: null,
    animethemesAudioUrl: "https://example.com/theme.ogg",
    audioFile: null,
    ...overrides,
  };
}

beforeEach(() => {
  bundleDir = mkdtempSync(join(tmpdir(), "gaq-deck-import-"));
});

afterEach(() => {
  db.delete(card).run();
  db.delete(song).run();
  db.delete(artist).run();
  db.delete(anime).run();
  db.delete(mediaLibrarySettings).run();
  rmSync(bundleDir, { recursive: true, force: true });
});

describe("importBundle", () => {
  it("skips an entry whose card already exists without touching its metadata", () => {
    const show = db.insert(anime).values({ aniListId: 1, titleRomaji: "Show", titleEnglish: "Show", titleNative: "作品" }).returning().get();
    const singer = db.insert(artist).values({ name: "Original artist" }).returning().get();
    const theme = db.insert(song).values({ animeId: show.id, artistId: singer.id, title: "Original song", themeSlot: "OP1" }).returning().get();
    db.insert(card).values({ songId: theme.id, animethemesAudioUrl: "https://example.com/existing.ogg" }).run();

    // A stale bundle re-exported before the user renamed the show/song/artist.
    writeManifest({
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: { type: "anime", id: show.id },
      cards: [
        baseEntry({
          anime: { aniListId: 1, animethemesId: null, titleEnglish: "Stale title", titleRomaji: "Stale title", titleNative: "Stale" },
          artistName: "Stale artist",
          song: { title: "Stale song", themeSlot: "OP1", animethemesThemeId: null },
        }),
      ],
    });

    const result = importBundle(bundleDir);
    expect(result).toEqual({ created: 0, skipped: 1, errors: [] });

    expect(db.select().from(anime).all()).toEqual([show]);
    expect(db.select().from(artist).all()).toEqual([singer]);
    expect(db.select().from(song).all()).toEqual([theme]);
    expect(db.select().from(card).all()).toHaveLength(1);
  });

  it("still creates a card for a genuinely new entry", () => {
    writeManifest({
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: { type: "anime", id: 1 },
      cards: [baseEntry()],
    });

    const result = importBundle(bundleDir);
    expect(result).toEqual({ created: 1, skipped: 0, errors: [] });

    const animeRows = db.select().from(anime).all();
    expect(animeRows).toHaveLength(1);
    expect(animeRows[0]).toMatchObject({ titleRomaji: "Show" });
    expect(db.select().from(song).all()).toHaveLength(1);
    expect(db.select().from(card).all()).toHaveLength(1);
  });

  it("does not overwrite an existing anime's metadata when importing a new theme for it", () => {
    const show = db.insert(anime).values({ aniListId: 1, titleRomaji: "Renamed show", titleEnglish: "Renamed show", titleNative: "改題" }).returning().get();

    // Same anime (by aniListId), but a second theme not yet present locally, from a stale bundle.
    writeManifest({
      version: 1,
      exportedAt: new Date().toISOString(),
      scope: { type: "anime", id: show.id },
      cards: [
        baseEntry({
          anime: { aniListId: 1, animethemesId: null, titleEnglish: "Stale title", titleRomaji: "Stale title", titleNative: "Stale" },
          song: { title: "New theme", themeSlot: "ED1", animethemesThemeId: null },
        }),
      ],
    });

    const result = importBundle(bundleDir);
    expect(result).toEqual({ created: 1, skipped: 0, errors: [] });

    const animeRows = db.select().from(anime).all();
    expect(animeRows).toHaveLength(1);
    expect(animeRows[0]).toMatchObject({ titleRomaji: "Renamed show", titleEnglish: "Renamed show", titleNative: "改題" });
  });
});
