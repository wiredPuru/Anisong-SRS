// The redaction that makes the Song name answer category safe: a suggestion
// must never carry the anime it belongs to, or the search aid for one question
// would answer the other question asked in the same round. The input type is
// deliberately narrow rather than FilteredSongSearchEntry, so this mapper
// cannot see an anime title, AniList id, theme slot, or clip URL even by
// accident - widening it is how the spoiler comes back.
export interface SongAnswerSource {
  songTitle: string | null;
  artistName: string | null;
}

export interface SongAnswerOption {
  key: string;
  songTitle: string;
  artistName: string | null;
}

const MAX_OPTIONS = 10;

export function toSongAnswerOptions(entries: readonly SongAnswerSource[]): SongAnswerOption[] {
  const unique = new Map<string, SongAnswerOption>();
  for (const entry of entries) {
    const songTitle = entry.songTitle?.trim();
    if (!songTitle) continue;
    const artistName = entry.artistName?.trim() || null;
    // One song credited to one artist is one suggestion, however many anime
    // the providers list it under - a repeated row would itself hint that the
    // song is used more than once.
    const key = `${songTitle.toLowerCase()}|${artistName?.toLowerCase() ?? ""}`;
    if (!unique.has(key)) unique.set(key, { key, songTitle, artistName });
    if (unique.size >= MAX_OPTIONS) break;
  }
  return [...unique.values()];
}
