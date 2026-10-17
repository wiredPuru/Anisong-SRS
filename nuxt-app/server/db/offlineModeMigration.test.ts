import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { describe, expect, it } from "vitest";
import { mediaLibrarySettings } from "./schema.ts";

describe("offline mode migration", () => {
  it("upgrades old settings without losing preferences and survives reopening", () => {
    const folder = mkdtempSync(join(tmpdir(), "gaq-offline-migration-"));
    const databasePath = join(folder, "library.db");
    const previousMigrations = join(folder, "previous-migrations");
    const migrationsFolder = "server/db/migrations";
    let sqlite = new Database(databasePath);
    try {
      const journal = JSON.parse(readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
        version: string;
        dialect: string;
        entries: { idx: number; tag: string; when: number; breakpoints: boolean; version: string }[];
      };
      journal.entries = journal.entries.filter((entry) => entry.idx <= 35);
      mkdirSync(join(previousMigrations, "meta"), { recursive: true });
      writeFileSync(join(previousMigrations, "meta/_journal.json"), JSON.stringify(journal));
      for (const entry of journal.entries) {
        copyFileSync(join(migrationsFolder, `${entry.tag}.sql`), join(previousMigrations, `${entry.tag}.sql`));
      }
      migrate(drizzle(sqlite), { migrationsFolder: previousMigrations });
      sqlite.prepare("INSERT INTO media_library_settings (id, library_paths, default_download_folder, auto_download, party_auto_download, clip_source, playback_mode, box_one_streak_required) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(1, JSON.stringify(["/saved/library"]), "/saved/library", 1, 1, "both", "audioOnly", 4);
      const previous = sqlite.prepare("SELECT * FROM media_library_settings").get() as Record<string, unknown>;
      expect(previous).not.toHaveProperty("offline_mode");

      const db = drizzle(sqlite);
      migrate(db, { migrationsFolder });
      expect(sqlite.prepare("SELECT * FROM media_library_settings").get()).toEqual({ ...previous, offline_mode: 0, playable_offline_only: 0 });
      db.update(mediaLibrarySettings).set({ offlineMode: true }).where(eq(mediaLibrarySettings.id, 1)).run();
      sqlite.close();
      sqlite = new Database(databasePath);
      const reopened = drizzle(sqlite);
      migrate(reopened, { migrationsFolder });
      expect(sqlite.prepare("SELECT * FROM media_library_settings").get()).toEqual({ ...previous, offline_mode: 1, playable_offline_only: 0 });
      expect(reopened.select({ offlineMode: mediaLibrarySettings.offlineMode }).from(mediaLibrarySettings).get())
        .toEqual({ offlineMode: true });
    } finally {
      sqlite.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
