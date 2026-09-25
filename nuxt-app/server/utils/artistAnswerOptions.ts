// Keep the Artist-answer search response narrow so these suggestions cannot
// reveal songs or anime that may be another answer in the round.
export interface ArtistAnswerSource {
  name: string;
}

export interface ArtistAnswerOption {
  key: string;
  artistName: string;
}

const MAX_OPTIONS = 10;

export function toArtistAnswerOptions(entries: readonly ArtistAnswerSource[]): ArtistAnswerOption[] {
  const unique = new Map<string, ArtistAnswerOption>();
  for (const entry of entries) {
    const artistName = entry.name.trim();
    if (!artistName) continue;
    const key = artistName.toLowerCase();
    if (!unique.has(key)) unique.set(key, { key, artistName });
    if (unique.size >= MAX_OPTIONS) break;
  }
  return [...unique.values()];
}
