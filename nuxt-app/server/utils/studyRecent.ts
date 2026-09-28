// The client sends 5; the cap only bounds what a hand-built URL can ask for.
export const MAX_RECENT_CARD_IDS = 20;

/**
 * Parses GET /api/study/next's `recent` query: the cards reviewed most recently
 * this session, oldest first. A repeated id keeps only its latest position.
 */
export function parseRecentCardIds(raw: unknown): { recentIds: number[] } | { error: string } {
  if (raw === undefined || raw === "") return { recentIds: [] };
  if (typeof raw !== "string") return { error: "recent must be a comma-separated list of card ids" };

  const parts = raw.split(",");
  if (parts.length > MAX_RECENT_CARD_IDS) {
    return { error: `recent can list at most ${MAX_RECENT_CARD_IDS} card ids` };
  }

  const ids: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part.trim())) return { error: "recent must be a comma-separated list of card ids" };
    const id = Number(part);
    if (!Number.isSafeInteger(id) || id <= 0) return { error: "recent must be a comma-separated list of card ids" };
    ids.push(id);
  }

  return { recentIds: ids.filter((id, index) => ids.lastIndexOf(id) === index) };
}
