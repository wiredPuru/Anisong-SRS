// Pure matching for `bun run deck-from-list`. A list entry names a song the way a
// playlist or video description does; a candidate is what the app's lookup routes
// returned. AnisongDB stores romanized titles, so each entry carries romaji
// spellings rather than the Japanese text it was copied from.

export type SlotType = "OP" | "ED" | "IN";

export interface ListEntry {
  /** The line as it was given, shown in the report. */
  label: string;
  /** Romanized song titles to try, most likely first. */
  songs: string[];
  /** Artist names (any one may match). */
  artists: string[];
  /** Romaji anime titles or distinctive fragments of them. */
  anime: string[];
  /** Searched on AniList when the song search finds nothing; native titles work well. */
  animeSearch?: string;
  slot?: SlotType;
  note?: string;
}

export interface DeckList {
  deck: string;
  source?: string;
  entries: ListEntry[];
}

export interface Candidate {
  songTitle: string;
  artistName: string;
  animeTitle: string;
  themeSlot: string;
}

export function matchKey(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

const MIN_PARTIAL = 4;

function overlaps(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_PARTIAL && long.includes(short);
}

function titleScore(entry: ListEntry, candidate: Candidate): number {
  const title = matchKey(candidate.songTitle);
  let best = 0;
  for (const song of entry.songs) {
    const key = matchKey(song);
    if (key === title) return 2;
    if (overlaps(key, title)) best = 1;
  }
  return best;
}

export function slotType(themeSlot: string): SlotType | null {
  if (themeSlot.startsWith("IN")) return "IN";
  if (themeSlot.startsWith("OP")) return "OP";
  if (themeSlot.startsWith("ED")) return "ED";
  return null;
}

/** 0 means no match. A title match is required, plus the artist or the anime. */
export function scoreCandidate(entry: ListEntry, candidate: Candidate, animeKnown = false): number {
  const title = titleScore(entry, candidate);
  if (title === 0) return 0;

  const artistKey = matchKey(candidate.artistName);
  const artist = entry.artists.some((name) => overlaps(matchKey(name), artistKey));
  const animeKey = matchKey(candidate.animeTitle);
  const anime = animeKnown || entry.anime.some((name) => overlaps(matchKey(name), animeKey));
  if (!artist && !anime) return 0;

  const slot = entry.slot !== undefined && slotType(candidate.themeSlot) === entry.slot;
  return title * 10 + (anime ? 4 : 0) + (artist ? 4 : 0) + (slot ? 1 : 0);
}

export function pickBest<T extends Candidate>(entry: ListEntry, candidates: T[], animeKnown = false): T | null {
  let best: T | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const score = scoreCandidate(entry, candidate, animeKnown);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

export function parseDeckList(raw: unknown): DeckList {
  if (typeof raw !== "object" || raw === null) throw new Error("List must be a JSON object.");
  const list = raw as Record<string, unknown>;
  if (typeof list.deck !== "string" || !list.deck.trim()) throw new Error("List needs a non-empty \"deck\" name.");
  if (!Array.isArray(list.entries) || list.entries.length === 0) throw new Error("List needs at least one entry.");

  const entries = list.entries.map((item, index) => {
    const entry = item as Record<string, unknown>;
    const strings = (value: unknown) => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "") : []);
    const songs = strings(entry.songs);
    if (songs.length === 0) throw new Error(`Entry ${index + 1} has no "songs".`);
    const slot = entry.slot === "OP" || entry.slot === "ED" || entry.slot === "IN" ? entry.slot : undefined;
    return {
      label: typeof entry.label === "string" ? entry.label : songs[0]!,
      songs,
      artists: strings(entry.artists),
      anime: strings(entry.anime),
      animeSearch: typeof entry.animeSearch === "string" && entry.animeSearch.trim() ? entry.animeSearch : undefined,
      slot,
      note: typeof entry.note === "string" ? entry.note : undefined,
    } satisfies ListEntry;
  });

  return { deck: list.deck.trim(), source: typeof list.source === "string" ? list.source : undefined, entries };
}
