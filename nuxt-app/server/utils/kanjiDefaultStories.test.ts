import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { kanjiDefaultStory } from "../db/schema.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { fetchTopStory } from "../lib/rtkStories.ts";
import { getDefaultStory } from "./kanjiDefaultStories.ts";
import { OfflineModeError } from "./networkMode.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

vi.mock("../lib/rtkStories.ts", () => ({
  fetchTopStory: vi.fn(),
  rtkPageUrl: (char: string) => `https://example.test/${char}`,
}));

const fetchMock = vi.mocked(fetchTopStory);

beforeEach(() => {
  db.delete(kanjiDefaultStory).run();
  fetchMock.mockReset();
});

describe("getDefaultStory", () => {
  it("fetches on a miss, stores the story, and serves the next call from the cache", async () => {
    fetchMock.mockResolvedValue({ status: "story", story: { author: "Copycatken", text: "Flowers change." } });
    const first = await getDefaultStory("花");
    expect(first).toEqual({ char: "花", text: "Flowers change.", author: "Copycatken", url: "https://example.test/花", reason: null });
    const second = await getDefaultStory("花");
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("caches a kanji the site has no story for", async () => {
    fetchMock.mockResolvedValue({ status: "none" });
    expect(await getDefaultStory("𠀀")).toMatchObject({ text: null, author: null, reason: "none" });
    await getDefaultStory("𠀀");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a provider failure, so the next call retries", async () => {
    fetchMock.mockRejectedValueOnce(new ProviderUnavailableError("The RTK story site"));
    expect(await getDefaultStory("花")).toMatchObject({ text: null, reason: "unavailable" });
    fetchMock.mockResolvedValueOnce({ status: "story", story: { author: "a", text: "b" } });
    expect(await getDefaultStory("花")).toMatchObject({ text: "b", reason: null });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports offline with no cache, and still serves a cached story", async () => {
    fetchMock.mockRejectedValue(new OfflineModeError());
    expect(await getDefaultStory("花")).toMatchObject({ text: null, reason: "offline" });
    db.insert(kanjiDefaultStory).values({ char: "魔", text: "Witch.", author: "x" }).run();
    expect(await getDefaultStory("魔")).toMatchObject({ text: "Witch.", reason: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
