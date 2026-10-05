import { sql } from "drizzle-orm";
import { anime } from "../db/schema.ts";

export function animeCoverRoute(animeId: number, fileName: string): string {
  return `/api/anime/cover?id=${animeId}&v=${fileName}`;
}

// The one place a client-facing cover URL is chosen: the local copy when the
// anime has one, otherwise the AniList URL. Selecting this instead of the raw
// column is what lets every cover read pick up a saved file with no UI change.
// Must stay in step with animeCoverRoute above.
export const animeCoverUrl = sql<string | null>`case when ${anime.coverImagePath} is not null then '/api/anime/cover?id=' || ${anime.id} || '&v=' || ${anime.coverImagePath} else ${anime.coverImageUrl} end`;
