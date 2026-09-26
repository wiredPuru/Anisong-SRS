import { isRecord, ProviderRequestError, ProviderUnavailableError, retryAfterMs } from "./graphql.ts";
import { USER_AGENT } from "../utils/mediaDownload.ts";
import { titleKey } from "../utils/textMatch.ts";
import { insertSlot } from "../utils/themeSlot.ts";

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
// "Insert Song". An insert carries no number, so it has no slot here; see
// themeGrouping for how one is named when inserts are included.
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

export interface ThemeOptions {
  includeInserts?: boolean;
}

function isInsertSongType(songType: unknown): boolean {
  return typeof songType === "string" && songType.trim() === "Insert Song";
}

function songTypes({ includeInserts = false }: ThemeOptions) {
  return { song_types: includeInserts ? ["opening", "ending", "insert"] : ["opening", "ending"] };
}

// What collapses duplicate copies of one theme together. An OP/ED is its slot.
// An insert has no number, so copies of it (a rebroadcast, say) are the same
// song title by the same artist, and its slot is decided once every copy has
// been seen: the lowest annSongId, which cannot change between imports.
export function themeGrouping(
  entry: Record<string, unknown>,
  { includeInserts = false }: ThemeOptions,
): { key: string; themeSlot: string | null } | null {
  const themeSlot = toThemeSlot(entry.songType);
  if (themeSlot) return { key: themeSlot, themeSlot };
  if (!includeInserts || !isInsertSongType(entry.songType) || annSongIdOf(entry) === null) return null;

  const title = titleKey(text(entry.songName));
  if (!title) return null;
  return { key: `insert:${title}:${titleKey(text(entry.songArtist)) ?? ""}`, themeSlot: null };
}

interface ThemeGroup {
  entry: Record<string, unknown>;
  themeSlot: string | null;
  lowestAnnSongId: number;
}

function annSongIdOf(entry: Record<string, unknown>): number | null {
  return typeof entry.annSongId === "number" && Number.isSafeInteger(entry.annSongId) ? entry.annSongId : null;
}

function addToGroup(groups: Map<string, ThemeGroup>, key: string, entry: Record<string, unknown>, themeSlot: string | null) {
  const id = annSongIdOf(entry) ?? Number.MAX_SAFE_INTEGER;
  const seen = groups.get(key);
  if (!seen) {
    groups.set(key, { entry, themeSlot, lowestAnnSongId: id });
    return;
  }
  if (outranks(entry, seen.entry)) seen.entry = entry;
  seen.lowestAnnSongId = Math.min(seen.lowestAnnSongId, id);
}

function groupSlot(group: ThemeGroup): string {
  return group.themeSlot ?? insertSlot(group.lowestAnnSongId);
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

export async function fetchThemesByMalId(malId: number, aniListId: number, options: ThemeOptions = {}): Promise<AnisongTheme[]> {
  for (const id of [malId, aniListId]) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Anime ID must be a positive integer.");
  }

  const groups = new Map<string, ThemeGroup>();

  for (const raw of await postJson("mal_ids_request", { mal_ids: [malId], ignore_duplicate: true })) {
    if (!isRecord(raw) || raw.isDub === true || !isForAnime(raw, malId, aniListId)) continue;
    const grouping = themeGrouping(raw, options);
    if (grouping) addToGroup(groups, grouping.key, raw, grouping.themeSlot);
  }

  return [...groups.values()]
    .map((group) => toTheme(group.entry, groupSlot(group)))
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

export async function searchArtists(query: string, options: ThemeOptions = {}): Promise<AnisongArtistCandidate[]> {
  const entries = await postJson("search_request", {
    artist_search_filter: { search: query, partial_match: true },
    filters: songTypes(options),
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
// so the same (anime, theme) collapses to whichever copy has the richest media,
// exactly as the per-anime import does.
function collectSongResults(entries: unknown[], options: ThemeOptions): AnisongSongResult[] {
  const groups = new Map<string, ThemeGroup>();
  const aniListIds = new Map<string, number>();

  for (const raw of entries) {
    if (!isRecord(raw) || raw.isDub === true) continue;
    const grouping = themeGrouping(raw, options);
    const aniListId = linkedId(raw, "anilist");
    if (!grouping || aniListId === null) continue;

    const key = `${aniListId}:${grouping.key}`;
    addToGroup(groups, key, raw, grouping.themeSlot);
    aniListIds.set(key, aniListId);
  }

  return [...groups]
    .map(([key, group]) => toSongResult(group.entry, groupSlot(group), aniListIds.get(key)!))
    .filter((result): result is AnisongSongResult => result !== null);
}

export async function searchSongs(query: string, options: ThemeOptions = {}): Promise<AnisongSongResult[]> {
  const entries = await postJson("search_request", {
    song_name_search_filter: { search: query, partial_match: true },
    filters: songTypes(options),
    ignore_duplicate: true,
  });

  return collectSongResults(entries, options)
    .sort((a, b) => relevance(a.songTitle, query) - relevance(b.songTitle, query) || a.annSongId - b.annSongId)
    .slice(0, MAX_SEARCH_RESULTS);
}

// Deliberately uncapped: this is one artist's whole catalog, the thing the bulk
// import exists to walk, not a dropdown.
export async function fetchArtistCatalog(artistId: number, options: ThemeOptions = {}): Promise<AnisongSongResult[]> {
  if (!Number.isSafeInteger(artistId) || artistId <= 0) throw new Error("Artist ID must be a positive integer.");

  return collectSongResults(await postJson("artist_ids_request", {
    artist_ids: [artistId],
    filters: songTypes(options),
    ignore_duplicate: true,
  }), options);
}
