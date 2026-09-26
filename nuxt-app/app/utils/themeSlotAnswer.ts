export type ThemeSlotType = "OP" | "ED" | "IN";

export interface ThemeSlotSelection {
  type: ThemeSlotType;
  number: number;
}

export function formatThemeSlot(selection: ThemeSlotSelection): string {
  return selection.type === "IN" ? "Insert" : `${selection.type}${selection.number}`;
}

// The stored themeSlot is not always the clean "OP1"/"ED2" shape it usually
// is - the real library also holds suffixed variants ("ED1-EN", "ED7-
// ShounenHen") and numbers into the high 20s/30 on long-running shows. A
// player can't reasonably type a suffix, so grading only needs the leading
// OP/ED + number.
export function normalizeThemeSlot(rawSlot: string): ThemeSlotSelection | null {
  if (isInsertThemeSlot(rawSlot)) return { type: "IN", number: 0 };
  const match = /^(OP|ED)(\d+)/i.exec(rawSlot.trim());
  if (!match) return null;
  return { type: match[1]!.toUpperCase() as ThemeSlotType, number: Number(match[2]) };
}

export function evaluateThemeSlotAnswer(expectedSlot: string, selection: ThemeSlotSelection): boolean {
  const expected = normalizeThemeSlot(expectedSlot);
  if (expected === null || expected.type !== selection.type) return false;
  // AMQ does not number inserts, so naming one an insert is the whole answer.
  return expected.type === "IN" || expected.number === selection.number;
}

// Insert slots (IN-<annSongId>) carry AnisongDB's song id only so each insert
// is unique; AMQ does not number inserts, so that id is never shown.
export function isInsertThemeSlot(rawSlot: string): boolean {
  return /^IN-\d+$/.test(rawSlot.trim());
}

export function formatThemeSlotLabel(rawSlot: string): string {
  return isInsertThemeSlot(rawSlot) ? "Insert" : rawSlot;
}
