import { afterEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { countAnimeCoversNotLocal, saveCoversLocally } from "./coverSaveLocal.ts";
import { upsertAnime } from "./lookup.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

function addAnime(aniListId: number, coverImageUrl: string | null): number {
  return upsertAnime({
    aniListId,
    animethemesId: null,
    titleEnglish: "Show",
    titleRomaji: "Show",
    titleNative: "Show",
    coverImageUrl,
  }).id;
}

afterEach(() => {
  db.delete(anime).run();
});

describe("saveCoversLocally", () => {
  it("counts only anime with a cover URL and no saved file", () => {
    addAnime(1, "https://s4.anilist.co/a.jpg");
    addAnime(2, null);
    expect(countAnimeCoversNotLocal()).toBe(1);
  });

  it("reports saved and failed counts and keeps going after a failure", async () => {
    const ids = [addAnime(1, "https://s4.anilist.co/a.jpg"), addAnime(2, "https://s4.anilist.co/b.jpg"), addAnime(3, "https://s4.anilist.co/c.jpg")];
    const ensure = vi.fn(async (id: number) => (id === ids[1] ? ("failed" as const) : ("saved" as const)));

    expect(await saveCoversLocally(ensure)).toEqual({ checked: 3, saved: 2, failed: 1 });
    expect(ensure).toHaveBeenCalledTimes(3);
  });

  it("does nothing when every cover is already local or absent", async () => {
    addAnime(1, null);
    const ensure = vi.fn();
    expect(await saveCoversLocally(ensure)).toEqual({ checked: 0, saved: 0, failed: 0 });
    expect(ensure).not.toHaveBeenCalled();
  });
});
