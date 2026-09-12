export interface AniListResult {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

// An anime can appear on both a user's AniList and MyAnimeList Completed
// lists; first occurrence wins so the AniList-sourced entry (queried first
// on /cards) takes priority over the MAL-crosswalked one when both exist.
export function mergeImportCandidates(lists: AniListResult[][]): AniListResult[] {
  const seen = new Set<number>();
  const merged: AniListResult[] = [];

  for (const list of lists) {
    for (const candidate of list) {
      if (seen.has(candidate.aniListId)) continue;
      seen.add(candidate.aniListId);
      merged.push(candidate);
    }
  }

  return merged;
}
