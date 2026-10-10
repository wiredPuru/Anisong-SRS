const INSERT_SLOT = /^IN-\d+$/;

// AMQ does not number insert songs, and a per-anime ordinal cannot be worked
// out from a single search result, so AnisongDB's own song id names the slot.
// It keeps (animeId, themeSlot) unique and is never shown or graded.
export function insertSlot(annSongId: number): string {
  return `IN-${annSongId}`;
}

export function isInsertSlot(slot: string): boolean {
  return INSERT_SLOT.test(slot.trim());
}

export type ThemeSlotType = "OP" | "ED" | "IN";

/** OP1 -> OP, ED2 -> ED, an insert slot -> IN; null for anything else. */
export function themeSlotType(slot: string): ThemeSlotType | null {
  const trimmed = slot.trim().toUpperCase();
  if (isInsertSlot(trimmed)) return "IN";
  if (trimmed.startsWith("OP")) return "OP";
  if (trimmed.startsWith("ED")) return "ED";
  return null;
}

/** Parses an optional themeTypes list; undefined or empty means every type. */
export function parseThemeTypes(value: unknown): ThemeSlotType[] | { error: string } {
  if (value === undefined || value === null) return [];
  const valid = Array.isArray(value) && value.every((type) => type === "OP" || type === "ED" || type === "IN");
  return valid ? [...new Set(value as ThemeSlotType[])] : { error: "themeTypes must be a list of OP, ED or IN" };
}

export function filterByThemeTypes<T extends { themeSlot: string }>(themes: T[], types: readonly ThemeSlotType[]): T[] {
  if (!types.length) return themes;
  return themes.filter((theme) => {
    const type = themeSlotType(theme.themeSlot);
    return type !== null && types.includes(type);
  });
}
