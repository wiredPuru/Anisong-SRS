import { USER_AGENT } from "../utils/mediaDownload.ts";

const JIKAN_BASE = "https://api.jikan.moe/v4";
// Safety net against a malformed or endlessly-paginating response; a real
// Completed list should finish well before this (Jikan pages at 300/page).
const MAX_PAGES = 10;

export interface JikanCompletedEntry {
  malId: number;
  title: string;
}

export class JikanUserNotFoundError extends Error {}

// Jikan's /users/{username}/animelist endpoint scrapes MyAnimeList directly
// rather than calling a stable API, and MAL intermittently blocks that scrape
// (observed firsthand as a 504 "failed to connect to MyAnimeList" during
// development) - this shape is Jikan's documented v4 schema, unverified
// against a live successful response.
interface JikanAnimeListResponse {
  data: { anime: { mal_id: number; title: string } }[];
  pagination?: { has_next_page: boolean };
}

export async function fetchMalCompletedList(username: string): Promise<JikanCompletedEntry[]> {
  const entries: JikanCompletedEntry[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const response = await fetch(
      `${JIKAN_BASE}/users/${encodeURIComponent(username)}/animelist/completed?page=${page}`,
      { headers: { "user-agent": USER_AGENT } },
    );

    if (response.status === 404) {
      throw new JikanUserNotFoundError(`MyAnimeList user "${username}" not found`);
    }
    if (!response.ok) {
      throw new Error(`Jikan completed-list lookup failed with status ${response.status}`);
    }

    const body = (await response.json()) as JikanAnimeListResponse;
    for (const item of body.data) {
      entries.push({ malId: item.anime.mal_id, title: item.anime.title });
    }

    if (!body.pagination?.has_next_page) break;
  }

  return entries;
}
