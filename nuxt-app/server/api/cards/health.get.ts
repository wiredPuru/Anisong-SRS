import { statSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { card } from "../../db/schema.ts";
import { getCardsByIds } from "../../utils/cards.ts";
import {
  classifyCardHealth,
  localFileState,
  needsAttention,
  type CardHealth,
  type LibraryHealthResponse,
} from "../../utils/libraryHealth.ts";
import { getClipSource, getDefaultDownloadFolder, getLibraryPaths } from "../../utils/mediaLibrary.ts";

// A stat that throws (permissions, an unmounted drive) reads as missing, which
// is also what /api/media would answer for it.
function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

export default defineEventHandler((event): LibraryHealthResponse => {
  const rawCardId = getQuery(event).cardId;
  let cardId: number | null = null;
  if (rawCardId !== undefined) {
    cardId = Number(rawCardId);
    if (!Number.isInteger(cardId) || cardId <= 0) {
      throw createError({ statusCode: 400, statusMessage: "cardId must be a positive integer" });
    }
  }

  const libraryPaths = getLibraryPaths();
  const clipSource = getClipSource();
  const hasDefaultDownloadFolder = getDefaultDownloadFolder() !== null;

  const sources = db
    .select({
      id: card.id,
      localVideoPath: card.localVideoPath,
      localAudioPath: card.localAudioPath,
      animethemesVideoUrl: card.animethemesVideoUrl,
      animethemesAudioUrl: card.animethemesAudioUrl,
    })
    .from(card)
    .where(cardId === null ? undefined : eq(card.id, cardId))
    .all();

  const flagged = new Map<number, CardHealth>();
  for (const row of sources) {
    const health = classifyCardHealth({
      ...row,
      videoState: row.localVideoPath ? localFileState(row.localVideoPath, libraryPaths, isFile) : null,
      audioState: row.localAudioPath ? localFileState(row.localAudioPath, libraryPaths, isFile) : null,
      clipSource,
      hasDefaultDownloadFolder,
    });
    if (needsAttention(health)) flagged.set(row.id, health);
  }

  const issues = getCardsByIds([...flagged.keys()])
    .sort((a, b) => a.id - b.id)
    .map((details) => ({ card: details, health: flagged.get(details.id)! }));

  return { checked: sources.length, clipSource, hasDefaultDownloadFolder, issues };
});
