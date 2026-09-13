import { isRecord, ProviderRequestError, ProviderUnavailableError, retryAfterMs } from "./graphql.ts";
import { USER_AGENT } from "../utils/mediaDownload.ts";

const ANISONGDB_ENDPOINT = "https://anisongdb.com/api/mal_ids_request";
const REQUEST_TIMEOUT_MS = 5_000;

// AMQ serves clips as bare filenames from regional distribution hosts. A stored
// card URL names one of them; parseAllowedStreamUrl accepts either, so a URL
// written by an older import keeps working if this constant ever changes.
const MEDIA_HOST = "https://naedist.animemusicquiz.com";

export interface AnisongTheme {
  themeSlot: string;
  songTitle: string | null;
  artistName: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}

async function postMalIds(malId: number): Promise<unknown[]> {
  let response: Response;
  try {
    response = await fetch(ANISONGDB_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({ mal_ids: [malId], ignore_duplicate: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ProviderUnavailableError("AnisongDB");
  }

  if ([403, 429].includes(response.status) || response.status >= 500) {
    throw new ProviderUnavailableError("AnisongDB", response.status === 429 ? retryAfterMs(response.headers.get("retry-after")) : 0);
  }
  if (!response.ok) throw new ProviderRequestError(`AnisongDB rejected the request (${response.status}).`);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ProviderUnavailableError("AnisongDB");
  }
  if (!Array.isArray(body)) throw new ProviderUnavailableError("AnisongDB");
  return body;
}

// Only three shapes exist in the live data: "Opening N", "Ending N", and
// "Insert Song". An insert song has no slot in Song's (animeId, themeSlot)
// uniqueness, so it maps to null and the entry is dropped.
export function toThemeSlot(songType: unknown): string | null {
  if (typeof songType !== "string") return null;
  const match = /^(Opening|Ending)\s+(\d+)$/.exec(songType.trim());
  if (!match) return null;
  return `${match[1] === "Opening" ? "OP" : "ED"}${Number(match[2])}`;
}

// A media value is a bare filename that gets pasted onto MEDIA_HOST, so anything
// with a path separator, a scheme, or a parent-directory hop could redirect the
// stored URL at another host entirely.
function mediaFilename(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value) && !value.includes("..") ? value : null;
}

function mediaUrl(value: unknown): string | null {
  const filename = mediaFilename(value);
  return filename ? `${MEDIA_HOST}/${filename}` : null;
}

function linkedId(entry: Record<string, unknown>, site: "myanimelist" | "anilist"): number | null {
  const links = entry.linked_ids;
  if (!isRecord(links)) return null;
  const id = links[site];
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

// mal_ids_request takes an array, so one response can legitimately carry entries
// for several anime. Both ids must match the anime being imported before any of
// its themes are used.
function isForAnime(entry: Record<string, unknown>, malId: number, aniListId: number): boolean {
  return linkedId(entry, "myanimelist") === malId && linkedId(entry, "anilist") === aniListId;
}

// Lower sorts first. Richer media wins, a rebroadcast loses to a broadcast copy,
// and annSongId breaks the remaining ties so a re-import cannot silently swap a
// card's source.
function rank(entry: Record<string, unknown>): [penalty: number, annSongId: number] {
  const penalty = (entry.isRebroadcast === true ? 8 : 0) +
    (mediaFilename(entry.HQ) ? 0 : 4) +
    (mediaFilename(entry.MQ) ? 0 : 2) +
    (mediaFilename(entry.audio) ? 0 : 1);
  const annSongId = typeof entry.annSongId === "number" ? entry.annSongId : Number.MAX_SAFE_INTEGER;
  return [penalty, annSongId];
}

function outranks(candidate: Record<string, unknown>, best: Record<string, unknown>): boolean {
  const [candidatePenalty, candidateId] = rank(candidate);
  const [bestPenalty, bestId] = rank(best);
  return candidatePenalty === bestPenalty ? candidateId < bestId : candidatePenalty < bestPenalty;
}

function toTheme(entry: Record<string, unknown>, themeSlot: string): AnisongTheme | null {
  const videoUrl = mediaUrl(entry.HQ) ?? mediaUrl(entry.MQ);
  const audioUrl = mediaUrl(entry.audio);
  // Importing a theme with no playable source would create a card that fails
  // feature 4's "at least one source" rule on save.
  if (!videoUrl && !audioUrl) return null;

  return {
    themeSlot,
    songTitle: typeof entry.songName === "string" && entry.songName.trim() ? entry.songName : null,
    artistName: typeof entry.songArtist === "string" && entry.songArtist.trim() ? entry.songArtist : null,
    videoUrl,
    audioUrl,
  };
}

export async function fetchThemesByMalId(malId: number, aniListId: number): Promise<AnisongTheme[]> {
  for (const id of [malId, aniListId]) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Anime ID must be a positive integer.");
  }

  const candidates = new Map<string, Record<string, unknown>>();

  for (const raw of await postMalIds(malId)) {
    if (!isRecord(raw) || raw.isDub === true || !isForAnime(raw, malId, aniListId)) continue;
    const themeSlot = toThemeSlot(raw.songType);
    if (!themeSlot) continue;

    const best = candidates.get(themeSlot);
    if (!best || outranks(raw, best)) candidates.set(themeSlot, raw);
  }

  return [...candidates]
    .map(([themeSlot, entry]) => toTheme(entry, themeSlot))
    .filter((theme): theme is AnisongTheme => theme !== null);
}
