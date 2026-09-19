// NFKC first so a title typed on a Japanese IME in full-width characters
// matches the half-width form the providers store. Whitespace is then dropped
// entirely, not just collapsed: romanized Japanese has no agreed word
// boundaries, so the same song is stored as "Kaze no Tadori Tsuku Basho" here
// and offered as "Kaze no Tadoritsuku Basho" by the search provider. Punctuation
// is still significant and there is no distance matching - this removes one
// systematic disagreement, it does not make grading fuzzy.
export function normalizeSongTitle(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

export function evaluateSongAnswer(
  card: { songTitle: string; songTitleNative: string },
  typed: string,
): boolean {
  const answer = normalizeSongTitle(typed);
  if (!answer) return false;
  return answer === normalizeSongTitle(card.songTitle) || answer === normalizeSongTitle(card.songTitleNative);
}
