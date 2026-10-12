import { eq } from "drizzle-orm";
import { isError } from "h3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { mediaLibrarySettings } from "../db/schema.ts";
import { getOfflineMode, setOfflineMode } from "./mediaLibrary.ts";
import { assertOnline, OfflineModeError } from "./networkMode.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";

vi.unmock("./networkMode.ts");

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

afterEach(() => db.delete(mediaLibrarySettings).run());

describe("offline mode setting", () => {
  it("allows online mode and rejects offline intent with a distinct typed error", () => {
    expect(assertOnline).not.toThrow();
    setOfflineMode(true);
    expect(assertOnline).toThrow(OfflineModeError);
    const error = new OfflineModeError();
    expect(error).toMatchObject({
      statusCode: 409,
      statusMessage: "Offline mode is enabled. Turn it off in Settings to use online features.",
      data: { code: "OFFLINE_MODE" },
    });
    expect(error).not.toBeInstanceOf(ProviderUnavailableError);
    expect(isError(error)).toBe(true);
    expect(error.unhandled).toBe(false);
    setOfflineMode(false);
    expect(assertOnline).not.toThrow();
  });

  it("defaults to online without creating a settings row", () => {
    expect(getOfflineMode()).toBe(false);
    expect(db.select().from(mediaLibrarySettings).all()).toEqual([]);
  });

  it("defaults an existing settings row to online", () => {
    db.insert(mediaLibrarySettings).values({ id: 1, autoDownload: true }).run();
    expect(getOfflineMode()).toBe(false);
  });

  it("persists both toggle values on the singleton row", () => {
    expect(setOfflineMode(true)).toEqual({ offlineMode: true });
    expect(getOfflineMode()).toBe(true);
    expect(setOfflineMode(false)).toEqual({ offlineMode: false });
    expect(getOfflineMode()).toBe(false);
    expect(db.select().from(mediaLibrarySettings).all()).toHaveLength(1);
  });

  it("reads committed changes rather than a remembered process value", () => {
    setOfflineMode(true);
    db.update(mediaLibrarySettings).set({ offlineMode: false }).where(eq(mediaLibrarySettings.id, 1)).run();
    expect(getOfflineMode()).toBe(false);
    db.update(mediaLibrarySettings).set({ offlineMode: true }).where(eq(mediaLibrarySettings.id, 1)).run();
    expect(getOfflineMode()).toBe(true);
  });

  it("changes no unrelated settings or other row", () => {
    const original = db.insert(mediaLibrarySettings).values({
      id: 1,
      libraryPaths: ["/library"],
      defaultDownloadFolder: "/library",
      dailyNewCardLimit: 7,
      boxOneStreakRequired: 4,
      streamCacheMaxBytes: 123456,
      playbackMode: "audioOnly",
      autoDownload: true,
      themesOnly: true,
      includeInsertSongs: true,
      clipSource: "both",
      partyAutoDownload: true,
    }).returning().get();
    const other = db.insert(mediaLibrarySettings).values({ id: 2 }).returning().get();
    for (const enabled of [true, true, false, false]) {
      setOfflineMode(enabled);
      expect(db.select().from(mediaLibrarySettings).where(eq(mediaLibrarySettings.id, 1)).get())
        .toEqual({ ...original, offlineMode: enabled });
      expect(db.select().from(mediaLibrarySettings).where(eq(mediaLibrarySettings.id, 2)).get()).toEqual(other);
    }
  });

  it.each([undefined, null, "true", "false", "", 0, 1, NaN, Infinity, [], {}, { enabled: true }])
    ("rejects non-boolean %j without creating or changing settings", (enabled) => {
      expect(setOfflineMode(enabled)).toEqual({ error: "enabled is required and must be a boolean" });
      expect(db.select().from(mediaLibrarySettings).all()).toEqual([]);
      setOfflineMode(true);
      const original = db.select().from(mediaLibrarySettings).all();
      expect(setOfflineMode(enabled)).toHaveProperty("error");
      expect(db.select().from(mediaLibrarySettings).all()).toEqual(original);
    });
});
