import type { CardWithDetails } from "./cards.ts";
import { type ClipSource, isClipUrlAllowed } from "./clipSource.ts";

export type PartyPhase = "idle" | "guessing" | "revealed";
export type PartyClipSource = { type: "local"; path: string } | { type: "remote"; url: string };
export interface PartyClip {
  kind: "video" | "audio";
  source: PartyClipSource;
}
export interface PartyAnswer {
  animeTitleEnglish: string;
  animeTitleRomaji: string;
  animeTitleNative: string;
  songTitle: string;
  artistName: string;
  themeSlot: string;
  coverImageUrl: string | null;
}
export interface PartyQueueItem {
  token: string;
  cardId: number;
  clip: PartyClip;
  answer: PartyAnswer;
}
export interface PartyPosition {
  token: string;
  currentTime: number;
  duration: number | null;
  playing: boolean;
}
export interface PartyGameState {
  version: number;
  queue: PartyQueueItem[];
  index: number;
  phase: PartyPhase;
  playing: boolean;
  startAt: number;
  seekTo: number | null;
  seekSeq: number;
  position: PartyPosition | null;
  randomStart: boolean;
  startFraction: number;
}
export type PartyCommand =
  | { type: "load"; cardIds: number[]; shuffle?: boolean }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; seconds: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "reveal" }
  | { type: "clear" }
  | { type: "jump"; index: number }
  | { type: "settings"; randomStart: boolean };

/** Sent to the display: never a path, URL, card id, or answer before reveal. */
export interface PartyDisplayState {
  version: number;
  phase: PartyPhase;
  item: { token: string; kind: "video" | "audio"; number: number; total: number } | null;
  playing: boolean;
  startAt: number;
  seekTo: number | null;
  seekSeq: number;
  startFraction: number;
  answer: PartyAnswer | null;
}
export interface PartyHostState {
  version: number;
  phase: PartyPhase;
  index: number;
  playing: boolean;
  queue: { cardId: number; kind: "video" | "audio"; answer: PartyAnswer }[];
  position: PartyPosition | null;
  randomStart: boolean;
}

export const PARTY_LOAD_MAX = 2000;

// randomStart is the host's preference, so it outlives any one game.
export function initialPartyState(version = 0, randomStart = false): PartyGameState {
  return {
    version,
    queue: [],
    index: -1,
    phase: "idle",
    playing: false,
    startAt: 0,
    seekTo: null,
    seekSeq: 0,
    position: null,
    randomStart,
    startFraction: 0,
  };
}

type ClipCard = Pick<CardWithDetails, "localVideoPath" | "localAudioPath" | "animethemesVideoUrl" | "animethemesAudioUrl">;

// Same preference Study uses: a local file beats a stream, and video beats
// audio unless Playback mode is Audio only. A local path whose file is gone
// (or outside the library) is passed over, so a stale path falls back to the
// stream instead of a clip that 404s mid-game.
export function pickPartyClip(
  card: ClipCard,
  settings: { clipSource: ClipSource; playbackMode: "auto" | "audioOnly" },
  localFileUsable: (path: string) => boolean = () => true,
): PartyClip | null {
  const remote = (url: string | null) => (url && isClipUrlAllowed(url, settings.clipSource) ? url : null);
  const local = (path: string | null) => (path && localFileUsable(path) ? path : null);
  const candidates: [PartyClip["kind"], PartyClipSource | null][] = [
    ["video", local(card.localVideoPath) ? { type: "local", path: card.localVideoPath! } : null],
    ["video", remote(card.animethemesVideoUrl) ? { type: "remote", url: card.animethemesVideoUrl! } : null],
    ["audio", local(card.localAudioPath) ? { type: "local", path: card.localAudioPath! } : null],
    ["audio", remote(card.animethemesAudioUrl) ? { type: "remote", url: card.animethemesAudioUrl! } : null],
  ];
  for (const [kind, source] of candidates) {
    if (!source || (kind === "video" && settings.playbackMode === "audioOnly")) continue;
    return { kind, source };
  }
  return null;
}

export function toQueueItem(card: CardWithDetails, clip: PartyClip, token: string): PartyQueueItem {
  return {
    token,
    cardId: card.id,
    clip,
    answer: {
      animeTitleEnglish: card.animeTitleEnglish,
      animeTitleRomaji: card.animeTitleRomaji,
      animeTitleNative: card.animeTitleNative,
      songTitle: card.songTitle,
      artistName: card.artistName,
      themeSlot: card.themeSlot,
      coverImageUrl: card.animeCoverImageUrl,
    },
  };
}

export function parsePartyCommand(body: unknown): PartyCommand | { error: string } {
  if (typeof body !== "object" || body === null) return { error: "A command object is required" };
  const { type } = body as { type?: unknown };
  switch (type) {
    case "play":
    case "pause":
    case "next":
    case "previous":
    case "reveal":
    case "clear":
      return { type };
    case "jump": {
      const { index } = body as { index?: unknown };
      if (!Number.isInteger(index) || (index as number) < 0) return { error: "index must be a whole number of 0 or more" };
      return { type, index: index as number };
    }
    case "settings": {
      const { randomStart } = body as { randomStart?: unknown };
      if (typeof randomStart !== "boolean") return { error: "randomStart must be a boolean" };
      return { type, randomStart };
    }
    case "seek": {
      const { seconds } = body as { seconds?: unknown };
      if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
        return { error: "seconds must be a number of 0 or more" };
      }
      return { type, seconds };
    }
    case "load": {
      const { cardIds, shuffle } = body as { cardIds?: unknown; shuffle?: unknown };
      if (!Array.isArray(cardIds) || cardIds.length === 0 || cardIds.length > PARTY_LOAD_MAX) {
        return { error: `cardIds must hold 1-${PARTY_LOAD_MAX} card ids` };
      }
      if (!cardIds.every((id) => Number.isInteger(id) && id > 0)) return { error: "cardIds must be positive integers" };
      if (shuffle !== undefined && typeof shuffle !== "boolean") return { error: "shuffle must be a boolean" };
      return { type, cardIds: [...new Set(cardIds as number[])], shuffle: shuffle === true };
    }
    default:
      return { error: "Unknown command" };
  }
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function atItem(state: PartyGameState, index: number, random: () => number): PartyGameState {
  return {
    ...state,
    index,
    phase: "guessing",
    playing: false,
    startAt: 0,
    seekTo: null,
    position: null,
    startFraction: state.randomStart ? random() : 0,
  };
}

/**
 * Returns the next state, or the same object when the command changes
 * nothing. `loaded` is the resolved queue for a `load` command.
 */
export function applyPartyCommand(
  state: PartyGameState,
  command: PartyCommand,
  options: { loaded?: PartyQueueItem[]; random?: () => number } = {},
): PartyGameState {
  const hasItem = state.index >= 0 && state.index < state.queue.length;
  const random = options.random ?? Math.random;
  let next: PartyGameState = state;

  switch (command.type) {
    case "load": {
      const loaded = options.loaded ?? [];
      if (!loaded.length) return state;
      const queue = command.shuffle ? shuffled(loaded, random) : loaded;
      next = atItem({ ...state, queue }, 0, random);
      break;
    }
    case "play":
    case "pause":
      if (hasItem && state.playing !== (command.type === "play")) next = { ...state, playing: command.type === "play" };
      break;
    case "seek":
      if (hasItem) next = { ...state, seekTo: command.seconds, seekSeq: state.seekSeq + 1 };
      break;
    case "next":
      if (hasItem && state.index < state.queue.length - 1) next = atItem(state, state.index + 1, random);
      break;
    case "previous":
      if (hasItem && state.index > 0) next = atItem(state, state.index - 1, random);
      break;
    case "jump":
      if (hasItem && command.index < state.queue.length && command.index !== state.index) {
        next = atItem(state, command.index, random);
      }
      break;
    case "settings":
      // Applies from the next song: the current one has already started.
      if (state.randomStart !== command.randomStart) next = { ...state, randomStart: command.randomStart };
      break;
    case "reveal":
      if (hasItem && state.phase !== "revealed") next = { ...state, phase: "revealed" };
      break;
    case "clear":
      if (state.index !== -1 || state.queue.length) next = initialPartyState(state.version, state.randomStart);
      break;
  }

  return next === state ? state : { ...next, version: state.version + 1 };
}

export function currentPartyItem(state: PartyGameState): PartyQueueItem | null {
  return state.queue[state.index] ?? null;
}

export function toDisplayState(state: PartyGameState): PartyDisplayState {
  const item = currentPartyItem(state);
  return {
    version: state.version,
    phase: state.phase,
    item: item
      ? { token: item.token, kind: item.clip.kind, number: state.index + 1, total: state.queue.length }
      : null,
    playing: state.playing,
    startAt: state.startAt,
    seekTo: state.seekTo,
    seekSeq: state.seekSeq,
    startFraction: state.startFraction,
    answer: item && state.phase === "revealed" ? item.answer : null,
  };
}

export function toHostState(state: PartyGameState): PartyHostState {
  return {
    version: state.version,
    phase: state.phase,
    index: state.index,
    playing: state.playing,
    queue: state.queue.map((item) => ({ cardId: item.cardId, kind: item.clip.kind, answer: item.answer })),
    position: state.position,
    randomStart: state.randomStart,
  };
}
