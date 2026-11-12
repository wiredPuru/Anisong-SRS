import type { StudyScope } from "./cards.ts";
import type { PartyClip } from "./partyGame.ts";
import { parseStudyFilters, type StudyFilters } from "./studyFilters.ts";

export const LITE_UP_NEXT = 4;
export const LITE_HISTORY_MAX = 30;
export const LITE_LABEL_MAX = 80;

// "stream" covers every song that will not be saved: no download folder,
// offline, or a download that failed.
export type LiteDownload = "local" | "waiting" | "downloading" | "stream";

export interface LiteAnswer {
  animeTitle: string;
  animeTitleRomaji: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
  coverImageUrl: string | null;
}

export interface LiteSong {
  token: string;
  cardId: number;
  manual: boolean;
  clip: PartyClip;
  answer: LiteAnswer;
  download: LiteDownload;
  progress: number | null;
}

export interface LiteSource {
  scope: StudyScope;
  label: string | null;
  filters: StudyFilters | null;
  endless: boolean;
}

export interface LitePosition {
  token: string;
  time: number;
  duration: number | null;
}

export interface LiteState {
  version: number;
  current: LiteSong | null;
  upNext: LiteSong[];
  history: LiteSong[];
  revealed: boolean;
  playing: boolean;
  seekTo: number;
  seekSeq: number;
  played: number;
  source: LiteSource;
  matchCount: number;
  position: LitePosition | null;
}

export type LiteCommand =
  | { type: "play" | "pause" | "reveal" | "next" | "previous" | "rerollAll" }
  | { type: "seek"; seconds: number }
  | { type: "remove" | "reroll"; token: string }
  | { type: "add"; cardId: number; position: "next" | "end" }
  | { type: "endless"; enabled: boolean }
  | { type: "source"; scope: StudyScope; label: string | null; filters: StudyFilters | null };

export function initialLiteState(): LiteState {
  return {
    version: 0,
    current: null,
    upNext: [],
    history: [],
    revealed: false,
    playing: false,
    seekTo: 0,
    seekSeq: 0,
    played: 0,
    source: { scope: { type: "all" }, label: null, filters: null, endless: true },
    matchCount: 0,
    position: null,
  };
}

const isId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;

function parseScope(raw: unknown): StudyScope | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { type, id } = raw as { type?: unknown; id?: unknown };
  if (type === "all") return { type };
  if ((type === "artist" || type === "anime" || type === "created") && isId(id)) return { type, id };
  return null;
}

export function parseLiteCommand(body: unknown): LiteCommand | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "A command object is required" };
  const raw = body as Record<string, unknown>;
  switch (raw.type) {
    case "play":
    case "pause":
    case "reveal":
    case "next":
    case "previous":
    case "rerollAll":
      return { type: raw.type };
    case "seek":
      if (typeof raw.seconds !== "number" || !Number.isFinite(raw.seconds) || raw.seconds < 0) return { error: "seconds must be zero or more" };
      return { type: "seek", seconds: raw.seconds };
    case "remove":
    case "reroll":
      if (typeof raw.token !== "string" || !raw.token) return { error: "token is required" };
      return { type: raw.type, token: raw.token };
    case "add":
      if (!isId(raw.cardId)) return { error: "cardId must be a positive whole number" };
      if (raw.position !== "next" && raw.position !== "end") return { error: "position must be 'next' or 'end'" };
      return { type: "add", cardId: raw.cardId, position: raw.position };
    case "endless":
      if (typeof raw.enabled !== "boolean") return { error: "enabled must be a boolean" };
      return { type: "endless", enabled: raw.enabled };
    case "source": {
      const scope = parseScope(raw.scope);
      if (!scope) return { error: "scope must be all, or an artist, anime, or created deck with an id" };
      const filters = parseStudyFilters(raw.filters);
      if ("error" in filters) return filters;
      const label = typeof raw.label === "string" && raw.label.trim() ? raw.label.trim().slice(0, LITE_LABEL_MAX) : null;
      return { type: "source", scope, label, filters: filters.filters };
    }
    default:
      return { error: "Unknown command" };
  }
}

/** Every song the game still holds, for looking one up by its token. */
export function allLiteSongs(state: LiteState): LiteSong[] {
  return [...(state.current ? [state.current] : []), ...state.upNext, ...state.history];
}

/** Moves to the next song; with nothing waiting the game goes idle. */
export function advance(state: LiteState): LiteState {
  const [next, ...rest] = state.upNext;
  const history = state.current ? [...state.history, state.current].slice(-LITE_HISTORY_MAX) : state.history;
  return {
    ...state,
    current: next ?? null,
    upNext: rest,
    history,
    revealed: false,
    playing: Boolean(next),
    seekTo: 0,
    position: null,
    played: next ? state.played + 1 : state.played,
  };
}

/** Back to the song before; the one that was playing waits at the front, kept as a hand pick so a reroll leaves it. */
export function goBack(state: LiteState): LiteState {
  const previous = state.history.at(-1);
  if (!previous) return state.current ? { ...state, seekTo: 0, seekSeq: state.seekSeq + 1 } : state;
  const upNext = state.current ? [{ ...state.current, manual: true }, ...state.upNext] : state.upNext;
  return {
    ...state,
    current: previous,
    upNext,
    history: state.history.slice(0, -1),
    revealed: false,
    playing: true,
    seekTo: 0,
    position: null,
    played: Math.max(1, state.played - 1),
  };
}

/** Hand picks stay ahead of filter picks: "next" goes first, "end" after the last hand pick. */
export function insertManual(state: LiteState, song: LiteSong, position: "next" | "end"): LiteState {
  const manual = state.upNext.filter((item) => item.manual);
  const auto = state.upNext.filter((item) => !item.manual);
  const picked = { ...song, manual: true };
  return { ...state, upNext: position === "next" ? [picked, ...manual, ...auto] : [...manual, picked, ...auto] };
}

export function removeSong(state: LiteState, token: string): LiteState {
  return { ...state, upNext: state.upNext.filter((item) => item.token !== token) };
}

export function replaceSong(state: LiteState, token: string, song: LiteSong): LiteState {
  return { ...state, upNext: state.upNext.map((item) => (item.token === token ? song : item)) };
}

export function withoutAutoPicks(state: LiteState): LiteState {
  return { ...state, upNext: state.upNext.filter((item) => item.manual) };
}

export function patchSong(state: LiteState, token: string, patch: Partial<LiteSong>): LiteState {
  const apply = (song: LiteSong) => (song.token === token ? { ...song, ...patch } : song);
  return {
    ...state,
    current: state.current ? apply(state.current) : null,
    upNext: state.upNext.map(apply),
    history: state.history.map(apply),
  };
}

/** How many filter picks are missing from Up next. */
export function fillNeeded(state: LiteState): number {
  return state.source.endless ? Math.max(0, LITE_UP_NEXT - state.upNext.length) : 0;
}

/** Cards the next filter pick must not repeat: playing, waiting, or just replaced. */
export function heldCardIds(state: LiteState): Set<number> {
  return new Set([...(state.current ? [state.current] : []), ...state.upNext].map((song) => song.cardId));
}

/**
 * Random picks from the pool. Held cards are never picked. Recently played
 * cards are skipped while anything else is left, then come back oldest first.
 */
export function pickCandidates(
  pool: readonly number[],
  held: ReadonlySet<number>,
  recent: readonly number[],
  count: number,
  random: () => number = Math.random,
): number[] {
  const free = [...new Set(pool)].filter((id) => !held.has(id));
  const lastPlayed = new Map(recent.map((id, at) => [id, at]));
  const fresh = free.filter((id) => !lastPlayed.has(id));
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
  }
  const stale = free.filter((id) => lastPlayed.has(id)).sort((a, b) => lastPlayed.get(a)! - lastPlayed.get(b)!);
  return [...fresh, ...stale].slice(0, Math.max(0, count));
}

type PublicAnswer = Omit<LiteAnswer, "coverImageUrl"> & { hasCover: boolean };

function publicAnswer(answer: LiteAnswer): PublicAnswer {
  const { coverImageUrl, ...rest } = answer;
  return { ...rest, hasCover: Boolean(coverImageUrl) };
}

export interface LiteDisplayState {
  phase: "idle" | "guessing" | "revealed";
  token: string | null;
  kind: "video" | "audio" | null;
  playing: boolean;
  seekTo: number;
  seekSeq: number;
  played: number;
  answer: PublicAnswer | null;
}

/** What the screen may know: never a path, URL, card id, or an answer before the reveal. */
export function toLiteDisplay(state: LiteState): LiteDisplayState {
  const song = state.current;
  return {
    phase: !song ? "idle" : state.revealed ? "revealed" : "guessing",
    token: song?.token ?? null,
    kind: song?.clip.kind ?? null,
    playing: state.playing,
    seekTo: state.seekTo,
    seekSeq: state.seekSeq,
    played: state.played,
    answer: song && state.revealed ? publicAnswer(song.answer) : null,
  };
}

export interface LiteHostSong {
  token: string;
  cardId: number;
  manual: boolean;
  kind: "video" | "audio";
  download: LiteDownload;
  progress: number | null;
  answer: PublicAnswer;
}

export interface LiteHostState {
  version: number;
  current: LiteHostSong | null;
  upNext: LiteHostSong[];
  canGoBack: boolean;
  revealed: boolean;
  playing: boolean;
  played: number;
  source: LiteSource;
  matchCount: number;
  position: LitePosition | null;
}

function hostSong(song: LiteSong): LiteHostSong {
  return {
    token: song.token,
    cardId: song.cardId,
    manual: song.manual,
    kind: song.clip.kind,
    download: song.download,
    progress: song.progress,
    answer: publicAnswer(song.answer),
  };
}

export function toLiteHost(state: LiteState): LiteHostState {
  return {
    version: state.version,
    current: state.current ? hostSong(state.current) : null,
    upNext: state.upNext.map(hostSong),
    canGoBack: state.history.length > 0,
    revealed: state.revealed,
    playing: state.playing,
    played: state.played,
    source: state.source,
    matchCount: state.matchCount,
    position: state.position,
  };
}

export function parseLitePosition(input: unknown): (LitePosition & { ended: boolean }) | null {
  if (!input || typeof input !== "object") return null;
  const { token, time, duration, ended } = input as Record<string, unknown>;
  const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (typeof token !== "string" || !isTime(time) || !(duration === null || isTime(duration))) return null;
  return { token, time, duration, ended: ended === true };
}
