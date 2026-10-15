// Covers that are missing or fail to load fall back to the deck tiles' look: a
// tinted tile with the name's first letter. The tint is hashed from a stable id
// so the same show or deck always gets the same colour.
export const COVER_TINT_TOKENS = ["--accent", "--accent-secondary", "--pass", "--warning"] as const;

export function coverTint(id: number): string {
  const index = Math.abs(Math.trunc(id)) % COVER_TINT_TOKENS.length;
  return COVER_TINT_TOKENS[index]!;
}

/** First letter or digit of the name (skipping punctuation), upper-cased. */
export function coverInitial(label: string): string {
  const match = label.trim().match(/[\p{L}\p{N}]/u);
  return match ? match[0].toUpperCase() : "?";
}
