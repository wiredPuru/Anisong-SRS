import { inArray } from "drizzle-orm";
import { db } from "../../../db/client.ts";
import { card } from "../../../db/schema.ts";
import { cardExistsForSong, createCard } from "../../../utils/cards.ts";
import { assertOnline } from "../../../utils/networkMode.ts";

// Makes cards for chosen themes of a looked-up show (the same cards /cards
// would add) and returns every card id, so the queue can load them.
export default defineEventHandler(async (event) => {
  assertOnline();
  const body = await readBody(event);
  const themes: unknown = body?.themes;
  const valid =
    Array.isArray(themes) &&
    themes.length > 0 &&
    themes.length <= 50 &&
    themes.every((t) => Number.isInteger(t?.songId) && t.songId > 0 && (t.videoUrl === null || typeof t.videoUrl === "string") && (t.audioUrl === null || typeof t.audioUrl === "string"));
  if (!valid) throw createError({ statusCode: 400, statusMessage: "themes must be 1 to 50 themes from anime-themes" });
  const picked = themes as { songId: number; videoUrl: string | null; audioUrl: string | null }[];
  const songIds = picked.map((t) => t.songId);
  for (const t of picked) {
    if (!cardExistsForSong(t.songId)) createCard({ songId: t.songId, animethemesVideoUrl: t.videoUrl, animethemesAudioUrl: t.audioUrl });
  }
  const cardIds = db.select({ id: card.id }).from(card).where(inArray(card.songId, songIds)).all().map((row) => row.id);
  return { cardIds };
});
