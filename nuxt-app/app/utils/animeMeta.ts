export interface AnimeMetaTag {
  name: string;
  rank: number;
}

export const ANIME_META_TAG_LIMIT = 3;
// AniList ranks each tag's relevance per show; below this a tag is often a
// passing element rather than what the show is about. Matches the Study
// filter's default tag rank (feature 76).
export const ANIME_META_MIN_TAG_RANK = 60;

/** "2009 · Kyoto Animation", or "" when neither is known. */
export function animeMetaLine(year: number | null | undefined, studios: readonly string[] | null | undefined): string {
  const parts: string[] = [];
  if (year != null) parts.push(String(year));
  if (studios?.length) parts.push(studios.join(", "));
  return parts.join(" · ");
}

/** The show's most relevant tag names, highest rank first. */
export function topAnimeTags(
  tags: readonly AnimeMetaTag[] | null | undefined,
  limit = ANIME_META_TAG_LIMIT,
  minRank = ANIME_META_MIN_TAG_RANK,
): string[] {
  if (!tags?.length) return [];
  return tags
    .filter((tag) => tag.rank >= minRank)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((tag) => tag.name);
}
