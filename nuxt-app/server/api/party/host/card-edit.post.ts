import { updateCard } from "../../../utils/cards.ts";
import { applyPartyCardEdit } from "../../../utils/partyStore.ts";

// Edits one card's song title, theme slot, artist (this song only) and notes
// from the host panel, then refreshes the queued copies.
export default defineEventHandler(async (event) => {
  const body = ((await readBody(event).catch(() => null)) ?? {}) as Record<string, unknown>;
  const { cardId, songTitle, themeSlot, artistName, notes } = body;
  if (!Number.isInteger(cardId) || (cardId as number) <= 0) throw createError({ statusCode: 400, statusMessage: "cardId must be a positive integer" });
  const text = (value: unknown) => (typeof value === "string" ? value : undefined);
  const result = updateCard({
    id: cardId as number,
    songTitle: text(songTitle),
    themeSlot: text(themeSlot),
    artistMode: typeof artistName === "string" ? "reassign" : undefined,
    artistName: text(artistName),
    notes: typeof notes === "string" ? notes : undefined,
  });
  if ("notFound" in result) throw createError({ statusCode: 404, statusMessage: "Card not found" });
  if ("error" in result) throw createError({ statusCode: 400, statusMessage: result.error });
  const { card } = result;
  applyPartyCardEdit({ cardId: card.id, songTitle: card.songTitle, themeSlot: card.themeSlot, artistName: card.artistName });
  return { ok: true };
});
