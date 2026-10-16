import { prepareCardDownload, runCardDownload } from "../../../utils/cardDownload.ts";
import { getCardWithDetails } from "../../../utils/cards.ts";
import { getClipSource, getOfflineMode, getPlaybackMode } from "../../../utils/mediaLibrary.ts";
import { hasLocalFile, partyDownloadKind } from "../../../utils/partyDownload.ts";
import { playDownloadedCard } from "../../../utils/partyStore.ts";

// Saves the clip the party would play for a library song, so it plays from
// disk. Answers with a flag only: no path leaves the host door.
export default defineEventHandler(async (event) => {
  const body = (await readBody(event).catch(() => null)) as { cardId?: unknown } | null;
  const cardId = body?.cardId;
  if (typeof cardId !== "number" || !Number.isSafeInteger(cardId) || cardId <= 0) {
    throw createError({ statusCode: 400, statusMessage: "cardId must be a positive whole number" });
  }
  const card = getCardWithDetails(cardId);
  if (!card) throw createError({ statusCode: 404, statusMessage: "Card not found" });
  if (hasLocalFile(card)) throw createError({ statusCode: 409, statusMessage: "That song is already downloaded." });
  const kind = partyDownloadKind(card, { clipSource: getClipSource(), playbackMode: getPlaybackMode(), offlineMode: getOfflineMode() });
  if (!kind) throw createError({ statusCode: 400, statusMessage: "That song has no clip the Clip source setting allows." });

  for await (const step of runCardDownload(prepareCardDownload(cardId, kind))) {
    if (step.type === "error") throw createError({ statusCode: 502, statusMessage: step.message });
    if (step.type === "done") {
      playDownloadedCard(cardId);
      return { downloaded: true };
    }
  }
  throw createError({ statusCode: 502, statusMessage: "The download stopped before it finished." });
});
