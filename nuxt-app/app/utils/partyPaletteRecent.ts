export const PALETTE_RECENT_KEY = "gaqSrs:partyPaletteRecent";
export const PALETTE_RECENT_LIMIT = 5;

function clean(ids: readonly unknown[], known: ReadonlySet<string>): string[] {
  const kept: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || !known.has(id) || kept.includes(id)) continue;
    kept.push(id);
    if (kept.length === PALETTE_RECENT_LIMIT) break;
  }
  return kept;
}

/** Stored recent command ids, newest first; anything unreadable or no longer a command is dropped. */
export function parseRecent(raw: string | null, known: ReadonlySet<string>): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? clean(parsed, known) : [];
  } catch {
    return [];
  }
}

export function pushRecent(recent: readonly string[], id: string, known: ReadonlySet<string>): string[] {
  return clean([id, ...recent], known);
}
