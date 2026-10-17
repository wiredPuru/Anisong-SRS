import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db/client.ts";
import { kanjiStory } from "../db/schema.ts";
import {
  deleteKanjiStory,
  getKanjiStory,
  listStoryChars,
  MAX_KANJI_STORY_LENGTH,
  parseStoryChar,
  parseStoryPutBody,
  saveKanjiStory,
} from "./kanjiStories.ts";

vi.mock("../db/client.ts", async () => {
  const { default: Database } = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");
  const db = drizzle(new Database(":memory:"));
  migrate(db, { migrationsFolder: "server/db/migrations" });
  return { db };
});

beforeEach(() => {
  db.delete(kanjiStory).run();
});

describe("parseStoryChar", () => {
  it("accepts one character, including a bare stroke shape", () => {
    expect(parseStoryChar("魔")).toEqual({ char: "魔" });
    expect(parseStoryChar("ノ")).toEqual({ char: "ノ" });
  });

  it("rejects blank, multi-character and non-string values", () => {
    expect(parseStoryChar(" ")).toHaveProperty("error");
    expect(parseStoryChar("魔鬼")).toHaveProperty("error");
    expect(parseStoryChar(undefined)).toHaveProperty("error");
    expect(parseStoryChar(5)).toHaveProperty("error");
  });
});

describe("parseStoryPutBody", () => {
  it("trims the text", () => {
    expect(parseStoryPutBody({ char: "魔", text: "  a demon  " })).toEqual({ char: "魔", text: "a demon" });
  });

  it("rejects empty, missing and over-long text and a bad char", () => {
    expect(parseStoryPutBody({ char: "魔", text: "   " })).toHaveProperty("error");
    expect(parseStoryPutBody({ char: "魔" })).toHaveProperty("error");
    expect(parseStoryPutBody({ char: "魔", text: "x".repeat(MAX_KANJI_STORY_LENGTH + 1) })).toHaveProperty("error");
    expect(parseStoryPutBody({ char: "魔鬼", text: "x" })).toHaveProperty("error");
    expect(parseStoryPutBody(null)).toHaveProperty("error");
  });

  it("accepts text of exactly the maximum length", () => {
    expect(parseStoryPutBody({ char: "魔", text: "x".repeat(MAX_KANJI_STORY_LENGTH) })).toHaveProperty("text");
  });
});

describe("story storage", () => {
  it("returns null for a character with no story", () => {
    expect(getKanjiStory("魔")).toBeNull();
  });

  it("saves, then replaces, a story", () => {
    saveKanjiStory("魔", "first");
    expect(getKanjiStory("魔")).toBe("first");
    saveKanjiStory("魔", "second");
    expect(getKanjiStory("魔")).toBe("second");
    expect(listStoryChars()).toEqual(["魔"]);
  });

  it("lists every character with a story", () => {
    saveKanjiStory("魔", "a");
    saveKanjiStory("鬼", "b");
    expect(listStoryChars().sort()).toEqual(["魔", "鬼"].sort());
  });

  it("deletes idempotently", () => {
    saveKanjiStory("魔", "a");
    expect(deleteKanjiStory("魔")).toEqual({ removed: true });
    expect(deleteKanjiStory("魔")).toEqual({ removed: false });
    expect(getKanjiStory("魔")).toBeNull();
  });
});
