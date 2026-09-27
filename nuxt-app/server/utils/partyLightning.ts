import type { PartyLightningMode } from "./partyGame.ts";

export interface PartyAnimeDetails {
  year: number | null;
  season: string | null;
  format: string | null;
  averageScore: number | null;
  genres: string[];
  tags: { name: string; rank: number }[];
}

export type PartyHints =
  | { kind: "clues"; items: { label: string; value: string }[] }
  | { kind: "tags"; items: string[] }
  | { kind: "title"; masked: string }
  | null;

export const EMPTY_DETAILS: PartyAnimeDetails = {
  year: null,
  season: null,
  format: null,
  averageScore: null,
  genres: [],
  tags: [],
};

const TAG_LIMIT = 8;
const GENRE_LIMIT = 3;
const FORMAT_LABELS: Record<string, string> = {
  TV: "TV",
  TV_SHORT: "TV short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music video",
};

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export function clueItems(details: PartyAnimeDetails): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (details.year) {
    items.push({ label: "Aired", value: details.season ? `${titleCase(details.season)} ${details.year}` : String(details.year) });
  }
  if (details.format) items.push({ label: "Format", value: FORMAT_LABELS[details.format] ?? details.format });
  if (details.averageScore !== null) items.push({ label: "AniList score", value: `${details.averageScore}%` });
  if (details.genres.length) items.push({ label: "Genres", value: details.genres.slice(0, GENRE_LIMIT).join(", ") });
  return items;
}

export function tagItems(details: PartyAnimeDetails): string[] {
  return [...details.tags].sort((a, b) => b.rank - a.rank).slice(0, TAG_LIMIT).map((tag) => tag.name);
}

// The first item shows at once and the last lands at the deadline, so the
// room always has something to go on and the final hint still counts.
export function revealedCount(total: number, elapsed: number, guessSeconds: number): number {
  if (total <= 0) return 0;
  if (elapsed >= guessSeconds) return total;
  return Math.min(total, 1 + Math.floor((Math.max(0, elapsed) * total) / guessSeconds));
}

function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

const HIDEABLE = /[\p{L}\p{N}]/u;

/** Letters and digits fill in, in an order fixed per song, reaching the whole title at the deadline. */
export function maskTitle(title: string, seed: string, elapsed: number, guessSeconds: number): string {
  const chars = [...title];
  const hideable = chars.flatMap((char, index) => (HIDEABLE.test(char) ? [index] : []));
  const random = seededRandom(seed);
  for (let i = hideable.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [hideable[i], hideable[j]] = [hideable[j]!, hideable[i]!];
  }
  const fraction = Math.min(1, Math.max(0, elapsed) / guessSeconds);
  const shown = new Set(hideable.slice(0, Math.floor(hideable.length * fraction)));
  return chars.map((char, index) => (HIDEABLE.test(char) && !shown.has(index) ? "_" : char)).join("");
}

export function lightningHints(
  item: { token: string; details: PartyAnimeDetails; answer: { animeTitleEnglish: string } },
  mode: PartyLightningMode,
  elapsed: number,
  guessSeconds: number,
): PartyHints {
  if (mode === "clues") {
    const all = clueItems(item.details);
    return { kind: "clues", items: all.slice(0, revealedCount(all.length, elapsed, guessSeconds)) };
  }
  if (mode === "tags") {
    const all = tagItems(item.details);
    return { kind: "tags", items: all.slice(0, revealedCount(all.length, elapsed, guessSeconds)) };
  }
  if (mode === "title") {
    return { kind: "title", masked: maskTitle(item.answer.animeTitleEnglish, item.token, elapsed, guessSeconds) };
  }
  return null;
}
