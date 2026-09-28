// How many just-reviewed cards Study asks the server to hold back.
export const RECENT_CARD_WINDOW = 5;

/** Moves `cardId` to the end of the oldest-first list, keeping at most `window` ids. */
export function withRecentCard(recentIds: readonly number[], cardId: number, window = RECENT_CARD_WINDOW): number[] {
  if (window <= 0) return [];
  return [...recentIds.filter((id) => id !== cardId), cardId].slice(-window);
}
