import type { CardWithDetails } from "./cards.ts";
import { type ClipSource, isClipUrlAllowed } from "./clipSource.ts";
import { EMPTY_DETAILS, lightningHints, type PartyAnimeDetails, type PartyHints } from "./partyLightning.ts";

export type PartyPhase = "idle" | "guessing" | "revealed";
export type PartyPicture = "video" | "blackout" | "cover";
export const LIGHTNING_MODES = ["regular", "blind", "peek", "cover", "clues", "tags", "title"] as const;
export type PartyLightningMode = (typeof LIGHTNING_MODES)[number];
export interface PartyLightning {
  mode: PartyLightningMode;
  guessSeconds: number;
  revealSeconds: number;
}
export interface PartyEffects {
  blur: number;
  pixelate: number;
  decay: boolean;
  decaySeconds: number;
  muted: boolean;
  picture: PartyPicture;
}
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
export interface PartyTimer {
  seconds: number;
  endsAt: number;
  autoReveal: boolean;
}
export interface PartyPlayer {
  id: number;
  name: string;
  score: number;
}
export interface PartyScoreboard {
  players: PartyPlayer[];
  visible: boolean;
}
export interface PartyBanner {
  text: string;
  shownAt: number;
}
export interface PartyMusic {
  enabled: boolean;
  volume: number;
}

export interface PartyQueueItem {
  token: string;
  cardId: number;
  clip: PartyClip;
  answer: PartyAnswer;
  // Only ever shown as lightning hints, and only as far as play time allows.
  details: PartyAnimeDetails;
}
export interface PartyPosition {
  token: string;
  currentTime: number;
  duration: number | null;
  playing: boolean;
  // Seconds played since the song's own start position; lightning rounds
  // time their reveal and advance from it.
  elapsed: number;
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
  effects: PartyEffects;
  nextEffects: PartyEffects | null;
  lightning: PartyLightning | null;
  revealedAtElapsed: number | null;
  timer: PartyTimer | null;
  scoreboard: PartyScoreboard;
  nextPlayerId: number;
  banner: PartyBanner | null;
  music: PartyMusic;
}
export type PartyScoreCommand =
  | { type: "score"; op: "add"; name: string }
  | { type: "score"; op: "rename"; id: number; name: string }
  | { type: "score"; op: "remove"; id: number }
  | { type: "score"; op: "adjust"; id: number; delta: number }
  | { type: "score"; op: "reset" }
  | { type: "score"; op: "show"; visible: boolean };
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
  | { type: "settings"; randomStart: boolean }
  | { type: "effects"; target: "current" | "next"; effects: PartyEffects | null }
  | { type: "lightning"; config: PartyLightning | null }
  | { type: "timer"; seconds: number; autoReveal: boolean }
  | { type: "timerStop" }
  | PartyScoreCommand
  | { type: "banner"; text: string | null }
  | { type: "music"; enabled: boolean; volume: number };

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
  effects: PartyEffects;
  lightning: { mode: PartyLightningMode; guessSeconds: number; hints: PartyHints } | null;
  timer: PartyTimer | null;
  scoreboard: PartyPlayer[] | null;
  banner: PartyBanner | null;
  music: PartyMusic;
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
  effects: PartyEffects;
  nextEffects: PartyEffects | null;
  lightning: PartyLightning | null;
  timer: PartyTimer | null;
  scoreboard: PartyScoreboard;
  banner: PartyBanner | null;
  music: PartyMusic;
}

export const PARTY_LOAD_MAX = 2000;
export const PLAYER_LIMIT = 20;
const PLAYER_NAME_MAX = 24;
const BANNER_MAX = 60;
export const DEFAULT_MUSIC: PartyMusic = { enabled: false, volume: 0.4 };

export const NO_EFFECTS: PartyEffects = {
  blur: 0,
  pixelate: 0,
  decay: false,
  decaySeconds: 20,
  muted: false,
  picture: "video",
};
const PICTURES: readonly PartyPicture[] = ["video", "blackout", "cover"];
const BLUR_MAX = 40;
const PIXELATE_MIN = 4;
const PIXELATE_MAX = 64;
const DECAY_MIN_S = 5;
const DECAY_MAX_S = 120;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const DEFAULT_LIGHTNING: PartyLightning = { mode: "regular", guessSeconds: 12, revealSeconds: 5 };

export function parsePartyLightning(raw: unknown): PartyLightning | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "config must be an object" };
  const { mode, guessSeconds, revealSeconds } = raw as Record<string, unknown>;
  if (!LIGHTNING_MODES.includes(mode as PartyLightningMode)) return { error: `mode must be one of ${LIGHTNING_MODES.join(", ")}` };
  const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  if (!isNumber(guessSeconds) || !isNumber(revealSeconds)) return { error: "guessSeconds and revealSeconds must be numbers" };
  return {
    mode: mode as PartyLightningMode,
    guessSeconds: Math.round(clamp(guessSeconds, 5, 60)),
    revealSeconds: Math.round(clamp(revealSeconds, 3, 30)),
  };
}

/** Numbers are clamped into range; a wrong type or an unknown picture is an error. */
export function parsePartyEffects(raw: unknown): PartyEffects | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "effects must be an object" };
  const { blur, pixelate, decay, decaySeconds, muted, picture } = raw as Record<string, unknown>;
  const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
  if (!isNumber(blur) || !isNumber(pixelate) || !isNumber(decaySeconds)) {
    return { error: "blur, pixelate, and decaySeconds must be numbers" };
  }
  if (typeof decay !== "boolean" || typeof muted !== "boolean") return { error: "decay and muted must be booleans" };
  if (!PICTURES.includes(picture as PartyPicture)) return { error: "picture must be 'video', 'blackout', or 'cover'" };
  return {
    blur: Math.round(clamp(blur, 0, BLUR_MAX)),
    pixelate: pixelate <= 0 ? 0 : Math.round(clamp(pixelate, PIXELATE_MIN, PIXELATE_MAX)),
    decay,
    decaySeconds: Math.round(clamp(decaySeconds, DECAY_MIN_S, DECAY_MAX_S)),
    muted,
    picture: picture as PartyPicture,
  };
}

// randomStart, effects, and lightning are how the host wants to play, so
// they outlive any one game.
export function initialPartyState(
  version = 0,
  randomStart = false,
  effects: PartyEffects = NO_EFFECTS,
  lightning: PartyLightning | null = null,
  kept: Pick<PartyGameState, "scoreboard" | "nextPlayerId" | "music"> = {
    scoreboard: { players: [], visible: false },
    nextPlayerId: 1,
    music: DEFAULT_MUSIC,
  },
): PartyGameState {
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
    effects,
    nextEffects: null,
    lightning,
    revealedAtElapsed: null,
    timer: null,
    banner: null,
    ...kept,
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

export function toQueueItem(
  card: CardWithDetails,
  clip: PartyClip,
  token: string,
  details: PartyAnimeDetails = EMPTY_DETAILS,
): PartyQueueItem {
  return {
    token,
    cardId: card.id,
    clip,
    details,
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
    case "lightning": {
      const { config } = body as { config?: unknown };
      if (config === null) return { type, config: null };
      const parsed = parsePartyLightning(config);
      return "error" in parsed ? parsed : { type, config: parsed };
    }
    case "timer": {
      const { seconds, autoReveal } = body as { seconds?: unknown; autoReveal?: unknown };
      if (!Number.isInteger(seconds) || (seconds as number) < 3 || (seconds as number) > 120) {
        return { error: "seconds must be a whole number from 3 to 120" };
      }
      if (typeof autoReveal !== "boolean") return { error: "autoReveal must be a boolean" };
      return { type, seconds: seconds as number, autoReveal };
    }
    case "timerStop":
      return { type };
    case "score":
      return parseScoreCommand(body as Record<string, unknown>);
    case "banner": {
      const { text } = body as { text?: unknown };
      if (text === null) return { type, text: null };
      const trimmed = typeof text === "string" ? text.trim() : "";
      if (!trimmed || trimmed.length > BANNER_MAX) return { error: `text must be 1-${BANNER_MAX} characters, or null` };
      return { type, text: trimmed };
    }
    case "music": {
      const { enabled, volume } = body as { enabled?: unknown; volume?: unknown };
      if (typeof enabled !== "boolean") return { error: "enabled must be a boolean" };
      if (typeof volume !== "number" || !Number.isFinite(volume)) return { error: "volume must be a number" };
      return { type, enabled, volume: clamp(volume, 0, 1) };
    }
    case "effects": {
      const { target, effects } = body as { target?: unknown; effects?: unknown };
      if (target !== "current" && target !== "next") return { error: "target must be 'current' or 'next'" };
      if (effects === null) return { type, target, effects: null };
      const parsed = parsePartyEffects(effects);
      return "error" in parsed ? parsed : { type, target, effects: parsed };
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

function parsePlayerName(raw: unknown): string | null {
  const name = typeof raw === "string" ? raw.trim() : "";
  return name && name.length <= PLAYER_NAME_MAX ? name : null;
}

function parseScoreCommand(body: Record<string, unknown>): PartyScoreCommand | { error: string } {
  const isId = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0;
  switch (body.op) {
    case "add": {
      const name = parsePlayerName(body.name);
      return name ? { type: "score", op: "add", name } : { error: `name must be 1-${PLAYER_NAME_MAX} characters` };
    }
    case "rename": {
      const name = parsePlayerName(body.name);
      if (!isId(body.id)) return { error: "id must be a player id" };
      return name ? { type: "score", op: "rename", id: body.id, name } : { error: `name must be 1-${PLAYER_NAME_MAX} characters` };
    }
    case "remove":
      return isId(body.id) ? { type: "score", op: "remove", id: body.id } : { error: "id must be a player id" };
    case "adjust":
      if (!isId(body.id)) return { error: "id must be a player id" };
      if (!Number.isInteger(body.delta)) return { error: "delta must be a whole number" };
      return { type: "score", op: "adjust", id: body.id, delta: body.delta as number };
    case "reset":
      return { type: "score", op: "reset" };
    case "show":
      return typeof body.visible === "boolean" ? { type: "score", op: "show", visible: body.visible } : { error: "visible must be a boolean" };
    default:
      return { error: "Unknown score op" };
  }
}

function applyScore(state: PartyGameState, command: PartyScoreCommand): PartyGameState {
  const { players } = state.scoreboard;
  const withPlayers = (next: PartyPlayer[]) => ({ ...state, scoreboard: { ...state.scoreboard, players: next } });
  switch (command.op) {
    case "add":
      if (players.length >= PLAYER_LIMIT) return state;
      return {
        ...withPlayers([...players, { id: state.nextPlayerId, name: command.name, score: 0 }]),
        nextPlayerId: state.nextPlayerId + 1,
      };
    case "rename":
      return players.some((p) => p.id === command.id)
        ? withPlayers(players.map((p) => (p.id === command.id ? { ...p, name: command.name } : p)))
        : state;
    case "remove":
      return players.some((p) => p.id === command.id) ? withPlayers(players.filter((p) => p.id !== command.id)) : state;
    case "adjust":
      return players.some((p) => p.id === command.id) && command.delta !== 0
        ? withPlayers(players.map((p) => (p.id === command.id ? { ...p, score: p.score + command.delta } : p)))
        : state;
    case "reset":
      return players.some((p) => p.score !== 0) ? withPlayers(players.map((p) => ({ ...p, score: 0 }))) : state;
    case "show":
      return state.scoreboard.visible === command.visible ? state : { ...state, scoreboard: { ...state.scoreboard, visible: command.visible } };
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
    // A lightning round always plays a random slice of each song.
    startFraction: state.randomStart || state.lightning ? random() : 0,
    effects: state.nextEffects ?? state.effects,
    nextEffects: null,
    revealedAtElapsed: null,
    timer: null,
  };
}

/**
 * Returns the next state, or the same object when the command changes
 * nothing. `loaded` is the resolved queue for a `load` command.
 */
export function applyPartyCommand(
  state: PartyGameState,
  command: PartyCommand,
  options: { loaded?: PartyQueueItem[]; random?: () => number; now?: () => number } = {},
): PartyGameState {
  const hasItem = state.index >= 0 && state.index < state.queue.length;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
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
    case "lightning":
      next = { ...state, lightning: command.config };
      break;
    case "timer":
      if (hasItem) next = { ...state, timer: { seconds: command.seconds, endsAt: now() + command.seconds * 1000, autoReveal: command.autoReveal } };
      break;
    case "timerStop":
      if (state.timer) next = { ...state, timer: null };
      break;
    case "score":
      next = applyScore(state, command);
      break;
    case "banner":
      if (command.text !== null) next = { ...state, banner: { text: command.text, shownAt: now() } };
      else if (state.banner) next = { ...state, banner: null };
      break;
    case "music":
      if (state.music.enabled !== command.enabled || state.music.volume !== command.volume) {
        next = { ...state, music: { enabled: command.enabled, volume: command.volume } };
      }
      break;
    case "effects":
      next = command.target === "current"
        ? { ...state, effects: command.effects ?? NO_EFFECTS }
        : { ...state, nextEffects: command.effects };
      break;
    case "reveal":
      if (hasItem && state.phase !== "revealed") {
        next = { ...state, phase: "revealed", revealedAtElapsed: state.position?.elapsed ?? 0 };
      }
      break;
    case "clear":
      if (state.index !== -1 || state.queue.length) {
        next = initialPartyState(state.version, state.randomStart, state.effects, state.lightning, {
          scoreboard: state.scoreboard,
          nextPlayerId: state.nextPlayerId,
          music: state.music,
        });
      }
      break;
  }

  return next === state ? state : { ...next, version: state.version + 1 };
}

export function currentPartyItem(state: PartyGameState): PartyQueueItem | null {
  return state.queue[state.index] ?? null;
}

// Revealed songs show every hint; otherwise hints follow the current song's
// reported play time.
function hintElapsed(state: PartyGameState): number {
  if (state.phase === "revealed") return Number.POSITIVE_INFINITY;
  const item = currentPartyItem(state);
  return item && state.position?.token === item.token ? state.position.elapsed : 0;
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
    effects: state.effects,
    lightning: state.lightning
      ? {
          mode: state.lightning.mode,
          guessSeconds: state.lightning.guessSeconds,
          hints: item ? lightningHints(item, state.lightning.mode, hintElapsed(state), state.lightning.guessSeconds) : null,
        }
      : null,
    timer: state.timer,
    scoreboard: state.scoreboard.visible ? [...state.scoreboard.players].sort((a, b) => b.score - a.score) : null,
    banner: state.banner,
    music: state.music,
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
    effects: state.effects,
    nextEffects: state.nextEffects,
    lightning: state.lightning,
    timer: state.timer,
    scoreboard: state.scoreboard,
    banner: state.banner,
    music: state.music,
  };
}

export type LightningStep = "reveal" | "next" | "stop";

/**
 * What a running lightning round should do now, judged from the display's
 * latest report for the current song. Paused or stale reports never act.
 */
export function lightningStep(state: PartyGameState): LightningStep | null {
  const { lightning, position } = state;
  const item = currentPartyItem(state);
  if (!lightning || !item || !position || position.token !== item.token || !state.playing) return null;

  if (state.phase === "guessing") {
    return position.elapsed >= lightning.guessSeconds ? "reveal" : null;
  }
  if (state.phase === "revealed") {
    const revealedAt = state.revealedAtElapsed ?? lightning.guessSeconds;
    if (position.elapsed < revealedAt + lightning.revealSeconds) return null;
    return state.index < state.queue.length - 1 ? "next" : "stop";
  }
  return null;
}
