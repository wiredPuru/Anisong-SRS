import { isRecord, ProviderUnavailableError } from "./graphql.ts";
import { USER_AGENT } from "../utils/mediaDownload.ts";

// MyAnimeList's own list endpoint - the page Jikan used to scrape on our
// behalf. Called directly because Jikan's copy answers 504 "failed to connect
// to MyAnimeList" on every request; this one needs no key, no cookie, and no
// browser-spoofed header. `status=2` is MAL's code for Completed.
const MAL_BASE = "https://myanimelist.net/animelist";
const PAGE_SIZE = 300;
// Safety net against a malformed or endlessly-paginating response; a real
// Completed list should finish well before this.
const MAX_PAGES = 10;

export interface MalCompletedEntry {
  malId: number;
  title: string;
}

export class MalUserNotFoundError extends Error {}

function mapEntry(value: unknown): MalCompletedEntry | null {
  if (!isRecord(value) || !Number.isSafeInteger(value.anime_id) || Number(value.anime_id) <= 0 ||
    typeof value.anime_title !== "string" || !value.anime_title.trim()) return null;
  return { malId: Number(value.anime_id), title: value.anime_title };
}

export async function fetchMalCompletedList(username: string, onPage?: (page: number, animeCount: number) => void): Promise<MalCompletedEntry[]> {
  const entries: MalCompletedEntry[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${MAL_BASE}/${encodeURIComponent(username)}/load.json?status=2&offset=${(page - 1) * PAGE_SIZE}`;
    let response: Response;
    try {
      response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
    } catch {
      throw new ProviderUnavailableError("MyAnimeList");
    }

    // MAL answers 400 for a username that does not exist and for one whose
    // list is private, with no way to tell the two apart from the response.
    if (response.status === 400 || response.status === 404) {
      throw new MalUserNotFoundError(`MyAnimeList user "${username}" not found, or their list is private`);
    }
    if (!response.ok) throw new ProviderUnavailableError("MyAnimeList");

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ProviderUnavailableError("MyAnimeList");
    }
    if (!Array.isArray(body)) throw new ProviderUnavailableError("MyAnimeList");

    const mapped = body.map(mapEntry).filter((entry): entry is MalCompletedEntry => entry !== null);
    // A page of entries we could not read at all means MAL changed the shape.
    // Reporting that as an empty list would look like the user has no anime.
    if (body.length && !mapped.length) throw new ProviderUnavailableError("MyAnimeList");
    entries.push(...mapped);

    onPage?.(page, entries.length);
    if (body.length < PAGE_SIZE) break;
  }

  return entries;
}
