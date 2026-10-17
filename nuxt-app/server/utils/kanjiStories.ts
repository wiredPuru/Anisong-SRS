import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { kanjiStory } from "../db/schema.ts";

export const MAX_KANJI_STORY_LENGTH = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseStoryChar(value: unknown): { error: string } | { char: string } {
  if (typeof value !== "string" || [...value].length !== 1 || !value.trim()) {
    return { error: "char must be a single character" };
  }
  return { char: value };
}

export function parseStoryPutBody(body: unknown): { error: string } | { char: string; text: string } {
  const parsed = parseStoryChar(isRecord(body) ? body.char : undefined);
  if ("error" in parsed) return parsed;
  const raw = (body as Record<string, unknown>).text;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (!text) return { error: "text is required; delete the story to clear it" };
  if (text.length > MAX_KANJI_STORY_LENGTH) {
    return { error: `text must be at most ${MAX_KANJI_STORY_LENGTH} characters` };
  }
  return { char: parsed.char, text };
}

export function getKanjiStory(char: string): string | null {
  return db.select({ text: kanjiStory.text }).from(kanjiStory).where(eq(kanjiStory.char, char)).get()?.text ?? null;
}

export function listStoryChars(): string[] {
  return db.select({ char: kanjiStory.char }).from(kanjiStory).all().map((row) => row.char);
}

export function saveKanjiStory(char: string, text: string): { char: string; text: string } {
  const updatedAt = new Date();
  db.insert(kanjiStory)
    .values({ char, text, updatedAt })
    .onConflictDoUpdate({ target: kanjiStory.char, set: { text, updatedAt } })
    .run();
  return { char, text };
}

export function deleteKanjiStory(char: string): { removed: boolean } {
  const rows = db.delete(kanjiStory).where(eq(kanjiStory.char, char)).returning({ char: kanjiStory.char }).all();
  return { removed: rows.length > 0 };
}
