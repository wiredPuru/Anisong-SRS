import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { kanjiDefaultStory } from "../db/schema.ts";
import { fetchTopStory, rtkPageUrl } from "../lib/rtkStories.ts";
import { OfflineModeError } from "./networkMode.ts";

export interface DefaultStoryReply {
  char: string;
  text: string | null;
  author: string | null;
  url: string;
  reason: "offline" | "unavailable" | "none" | null;
}

function reply(char: string, text: string | null, author: string | null): DefaultStoryReply {
  return { char, text, author, url: rtkPageUrl(char), reason: text ? null : "none" };
}

// The default is an extra beside the user's own story, so provider trouble
// comes back as a reason instead of an error.
export async function getDefaultStory(char: string): Promise<DefaultStoryReply> {
  const cached = db.select().from(kanjiDefaultStory).where(eq(kanjiDefaultStory.char, char)).get();
  if (cached) return reply(char, cached.text, cached.author);
  try {
    const result = await fetchTopStory(char);
    const text = result.status === "story" ? result.story.text : null;
    const author = result.status === "story" ? result.story.author : null;
    db.insert(kanjiDefaultStory).values({ char, text, author }).onConflictDoNothing().run();
    return reply(char, text, author);
  } catch (failure) {
    const offline = failure instanceof OfflineModeError || (failure as { statusCode?: number }).statusCode === 409;
    return { ...reply(char, null, null), reason: offline ? "offline" : "unavailable" };
  }
}
