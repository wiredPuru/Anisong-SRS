import { isRecord, ProviderRequestError, ProviderUnavailableError, retryAfterMs } from "./graphql.ts";
import { USER_AGENT } from "../utils/mediaDownload.ts";
import { titleKey } from "../utils/textMatch.ts";

const ANISONGDB_BASE_URL = "https://anisongdb.com/api";
const REQUEST_TIMEOUT_MS = 5_000;

// search_request answers with everything it matches, up to a server-side cap of
// 500 unranked entries (a 640KB payload for "love"), so the ranking below is
// what keeps a live-search dropdown usable.
const MAX_SEARCH_RESULTS = 10;

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

async function postJson(path: string, payload: unknown): Promise<unknown[]> {
  let response: Response;
  try {
    response = await fetch(`${ANISONGDB_BASE_URL}/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify(payload),
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

  for (const raw of await postJson("mal_ids_request", { mal_ids: [malId], ignore_duplicate: true })) {
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

export interface AnisongSongResult {
  annSongId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string | null;
  animeAniListId: number;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

// Insert songs have no slot in Song's (animeId, themeSlot) uniqueness, so they
// are excluded here rather than filtered out of a larger payload.
const OP_ED_ONLY = { song_types: ["opening", "ending"] };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function toSongResult(entry: Record<string, unknown>, themeSlot: string, aniListId: number): AnisongSongResult | null {
  const annSongId = typeof entry.annSongId === "number" ? entry.annSongId : null;
  const songTitle = text(entry.songName);
  // animeJPName is AMQ's romanized title, matching what AnimeThemes returns as
  // title { romaji }. It is display-only: the import re-resolves the anime from
  // its AniList id.
  const animeTitleRomaji = text(entry.animeJPName) ?? text(entry.animeENName);
  if (annSongId === null || !songTitle || !animeTitleRomaji) return null;

  const videoUrl = mediaUrl(entry.HQ) ?? mediaUrl(entry.MQ);
  const audioUrl = mediaUrl(entry.audio);
  if (!videoUrl && !audioUrl) return null;

  return {
    annSongId,
    themeSlot,
    songTitle,
    artistName: text(entry.songArtist),
    animeAniListId: aniListId,
    animeTitleRomaji,
    videoUrl,
    audioUrl,
  };
}

// Lower sorts first. AnisongDB returns matches in no useful order, so this is
// the only thing standing between a query and an arbitrary slice of 500 songs.
export function relevance(candidate: string | null, query: string): number {
  const value = titleKey(candidate) ?? "";
  const needle = titleKey(query) ?? "";
  if (!needle || !value) return 3;
  if (value === needle) return 0;
  if (value.startsWith(needle)) return 1;
  return value.includes(needle) ? 2 : 3;
}

export interface AnisongArtistCandidate {
  id: number;
  name: string;
}

function names(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((name): name is string => typeof name === "string" && !!name.trim()) : [];
}

export async function searchArtists(query: string): Promise<AnisongArtistCandidate[]> {
  const entries = await postJson("search_request", {
    artist_search_filter: { search: query, partial_match: true },
    filters: OP_ED_ONLY,
    ignore_duplicate: true,
  });

  // A matching entry credits everyone who performed on it, not just the artist
  // that matched: searching "LiSA" brings back m-flo and Hyadain through
  // collaborations. Only an artist whose own name matches is a real candidate.
  const candidates = new Map<number, { id: number; name: string; rank: number; songs: number }>();

  for (const raw of entries) {
    if (!isRecord(raw) || raw.isDub === true) continue;

    for (const artist of Array.isArray(raw.artists) ? raw.artists : []) {
      if (!isRecord(artist)) continue;
      const id = typeof artist.id === "number" ? artist.id : null;
      const known = names(artist.names);
      if (id === null || !known.length) continue;

      // An artist can carry several romanizations; the closest one decides.
      const rank = Math.min(...known.map((name) => relevance(name, query)));
      if (rank === 3) continue;

      const seen = candidates.get(id);
      if (seen) seen.songs += 1;
      else candidates.set(id, { id, name: known[0]!, rank, songs: 1 });
    }
  }

  return [...candidates.values()]
    .sort((a, b) => a.rank - b.rank || b.songs - a.songs || a.id - b.id)
    .slice(0, MAX_SEARCH_RESULTS)
    .map(({ id, name }) => ({ id, name }));
}

// One theme can come back several times (a rebroadcast carries its own entry),
// so the same (anime, slot) collapses to whichever copy has the richest media,
// exactly as the per-anime import does.
function collectSongResults(entries: unknown[]): AnisongSongResult[] {
  const bestPerTheme = new Map<string, { entry: Record<string, unknown>; themeSlot: string; aniListId: number }>();

  for (const raw of entries) {
    if (!isRecord(raw) || raw.isDub === true) continue;
    const themeSlot = toThemeSlot(raw.songType);
    const aniListId = linkedId(raw, "anilist");
    if (!themeSlot || aniListId === null) continue;

    const key = `${aniListId}:${themeSlot}`;
    const best = bestPerTheme.get(key);
    if (!best || outranks(raw, best.entry)) bestPerTheme.set(key, { entry: raw, themeSlot, aniListId });
  }

  return [...bestPerTheme.values()]
    .map(({ entry, themeSlot, aniListId }) => toSongResult(entry, themeSlot, aniListId))
    .filter((result): result is AnisongSongResult => result !== null);
}

export async function searchSongs(query: string): Promise<AnisongSongResult[]> {
  const entries = await postJson("search_request", {
    song_name_search_filter: { search: query, partial_match: true },
    filters: OP_ED_ONLY,
    ignore_duplicate: true,
  });

  return collectSongResults(entries)
    .sort((a, b) => relevance(a.songTitle, query) - relevance(b.songTitle, query) || a.annSongId - b.annSongId)
    .slice(0, MAX_SEARCH_RESULTS);
}

// Deliberately uncapped: this is one artist's whole catalog, the thing the bulk
// import exists to walk, not a dropdown.
export async function fetchArtistCatalog(artistId: number): Promise<AnisongSongResult[]> {
  if (!Number.isSafeInteger(artistId) || artistId <= 0) throw new Error("Artist ID must be a positive integer.");

  return collectSongResults(await postJson("artist_ids_request", {
    artist_ids: [artistId],
    filters: OP_ED_ONLY,
    ignore_duplicate: true,
  }));
}
