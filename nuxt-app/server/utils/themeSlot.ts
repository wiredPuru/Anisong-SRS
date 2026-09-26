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
