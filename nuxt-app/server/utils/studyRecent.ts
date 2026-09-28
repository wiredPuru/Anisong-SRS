// The client sends 5; the cap only bounds what a hand-built URL can ask for.
export const MAX_RECENT_CARD_IDS = 20;
// Burials only grow within one session; the cap keeps the query string sane.
export const MAX_BURIED_CARD_IDS = 500;

/**
 * Parses a comma-separated card id query param, oldest first. A repeated id
 * keeps only its latest position. Absent or empty means no ids.
 */
export function parseCardIdList(raw: unknown, param: string, max: number): { ids: number[] } | { error: string } {
  if (raw === undefined || raw === "") return { ids: [] };
  const malformed = { error: `${param} must be a comma-separated list of card ids` };
  if (typeof raw !== "string") return malformed;

  const parts = raw.split(",");
  if (parts.length > max) return { error: `${param} can list at most ${max} card ids` };

  const ids: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part.trim())) return malformed;
    const id = Number(part);
    if (!Number.isSafeInteger(id) || id <= 0) return malformed;
    ids.push(id);
  }

  return { ids: ids.filter((id, index) => ids.lastIndexOf(id) === index) };
}

/** GET /api/study/next's `recent` query: the cards reviewed most recently this session. */
export function parseRecentCardIds(raw: unknown): { recentIds: number[] } | { error: string } {
  const parsed = parseCardIdList(raw, "recent", MAX_RECENT_CARD_IDS);
  return "error" in parsed ? parsed : { recentIds: parsed.ids };
}

/** GET /api/study/next's `bury` query: cards skipped for the rest of this session. */
export function parseBuriedCardIds(raw: unknown): { buriedIds: number[] } | { error: string } {
  const parsed = parseCardIdList(raw, "bury", MAX_BURIED_CARD_IDS);
  return "error" in parsed ? parsed : { buriedIds: parsed.ids };
}

/** GET /api/study/next's `prefer` query: a card to serve first if it is due, such as one just undone. */
export function parsePreferredCardId(raw: unknown): { preferId: number | null } | { error: string } {
  const parsed = parseCardIdList(raw, "prefer", 1);
  return "error" in parsed ? parsed : { preferId: parsed.ids[0] ?? null };
}
