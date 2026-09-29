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
  // Joined from a phone through the player door (feature 90a), rather than
  // typed in by the host. Only a phone player can be connected.
  phone: boolean;
  connected: boolean;
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
/** Who is answering the current song from a phone buzzer (feature 90b). */
export interface PartyBuzz {
  playerId: number | null;
  // Buzzed and got it wrong: no second buzz on this song.
  lockedOut: number[];
  winnerId: number | null;
}
export const NO_BUZZ: PartyBuzz = { playerId: null, lockedOut: [], winnerId: null };

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
  blocked: boolean;
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
  // The display's corner chip with the player join address and room code.
  joinInfoVisible: boolean;
  buzzerEnabled: boolean;
  buzz: PartyBuzz;
  // Who scored each song, by queue item token (feature 90c).
  awards: Record<string, number[]>;
  summaryVisible: boolean;
}
export interface PartySummary {
  standings: { rank: number; name: string; score: number }[];
  songs: { number: number; anime: string; song: string; scorers: string[] }[];
  played: number;
  total: number;
}
export type PartyScoreCommand =
  | { type: "score"; op: "add"; name: string }
  | { type: "score"; op: "rename"; id: number; name: string }
  | { type: "score"; op: "remove"; id: number }
  | { type: "score"; op: "adjust"; id: number; delta: number }
  | { type: "score"; op: "reset" }
  | { type: "score"; op: "show"; visible: boolean };
export type PartyCommand =
  | { type: "load"; cardIds: number[]; shuffle?: boolean; downloadedOnly?: boolean; append?: boolean }
  | { type: "queueRemove"; index: number }
  | { type: "queueMove"; from: number; to: number }
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
  | { type: "music"; enabled: boolean; volume: number }
  | { type: "joinInfo"; visible: boolean }
  | { type: "buzzer"; enabled: boolean }
  | { type: "buzzJudge"; correct: boolean }
  | { type: "award"; playerId: number; awarded: boolean }
  | { type: "summary"; visible: boolean };
/**
 * Commands only the server itself issues, on a phone's behalf. parsePartyCommand
 * never produces them, so the host command route cannot forge a phone join.
 */
export type PartyInternalCommand =
  | { type: "playerJoin"; name: string; claimId: number | null }
  | { type: "playerConnection"; id: number; connected: boolean }
  | { type: "buzz"; playerId: number };
export interface PartyJoinInfo {
  code: string;
  urls: string[];
}

/** Sent to the display: never a path, URL, card id, or answer before reveal. */
export interface PartyDisplayState {
  version: number;
  phase: PartyPhase;
  item: { token: string; kind: "video" | "audio"; number: number; total: number } | null;
  /** The next songs' tokens, so the display can buffer them ahead. */
  upcoming: string[];
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
  join: PartyJoinInfo | null;
  buzz: { answering: string | null; winner: string | null };
  summary: PartySummary | null;
}
/** Sent to a joined phone: never an answer, clip token, or card id. */
export interface PartyPlayerState {
  version: number;
  me: { id: number; name: string; score: number } | null;
  phase: PartyPhase;
  song: { number: number; total: number } | null;
  players: { name: string; score: number }[];
  buzzer: {
    enabled: boolean;
    canBuzz: boolean;
    answering: string | null;
    answeringIsMe: boolean;
    lockedOut: boolean;
    winner: string | null;
  };
  // Only once revealed, when the display already shows it.
  answer: { anime: string; song: string; artist: string } | null;
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
  joinInfoVisible: boolean;
  buzzerEnabled: boolean;
  buzz: PartyBuzz;
  currentAwards: number[];
  summaryVisible: boolean;
}

export const PARTY_LOAD_MAX = 2000;
/** How many songs past the current one the server caches and the display buffers. */
export const PARTY_LOOKAHEAD = 2;
export const PLAYER_LIMIT = 20;
export const PLAYER_NAME_MAX = 24;
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
  kept: Pick<PartyGameState, "scoreboard" | "nextPlayerId" | "music" | "joinInfoVisible" | "buzzerEnabled"> = {
    scoreboard: { players: [], visible: false },
    nextPlayerId: 1,
    music: DEFAULT_MUSIC,
    joinInfoVisible: true,
    buzzerEnabled: false,
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
    buzz: NO_BUZZ,
    awards: {},
    summaryVisible: false,
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
  settings: { clipSource: ClipSource; playbackMode: "auto" | "audioOnly"; downloadedOnly?: boolean },
  localFileUsable: (path: string) => boolean = () => true,
): PartyClip | null {
  const remote = (url: string | null) =>
    url && !settings.downloadedOnly && isClipUrlAllowed(url, settings.clipSource) ? url : null;
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
    case "joinInfo": {
      const { visible } = body as { visible?: unknown };
      return typeof visible === "boolean" ? { type, visible } : { error: "visible must be a boolean" };
    }
    case "buzzer": {
      const { enabled } = body as { enabled?: unknown };
      return typeof enabled === "boolean" ? { type, enabled } : { error: "enabled must be a boolean" };
    }
    case "buzzJudge": {
      const { correct } = body as { correct?: unknown };
      return typeof correct === "boolean" ? { type, correct } : { error: "correct must be a boolean" };
    }
    case "summary": {
      const { visible } = body as { visible?: unknown };
      return typeof visible === "boolean" ? { type, visible } : { error: "visible must be a boolean" };
    }
    case "award": {
      const { playerId, awarded } = body as { playerId?: unknown; awarded?: unknown };
      if (!Number.isInteger(playerId) || (playerId as number) <= 0) return { error: "playerId must be a player id" };
      if (typeof awarded !== "boolean") return { error: "awarded must be a boolean" };
      return { type, playerId: playerId as number, awarded };
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
      const { cardIds, shuffle, downloadedOnly, append } = body as {
        cardIds?: unknown;
        shuffle?: unknown;
        downloadedOnly?: unknown;
        append?: unknown;
      };
      if (!Array.isArray(cardIds) || cardIds.length === 0 || cardIds.length > PARTY_LOAD_MAX) {
        return { error: `cardIds must hold 1-${PARTY_LOAD_MAX} card ids` };
      }
      if (!cardIds.every((id) => Number.isInteger(id) && id > 0)) return { error: "cardIds must be positive integers" };
      if (shuffle !== undefined && typeof shuffle !== "boolean") return { error: "shuffle must be a boolean" };
      if (downloadedOnly !== undefined && typeof downloadedOnly !== "boolean") return { error: "downloadedOnly must be a boolean" };
      if (append !== undefined && typeof append !== "boolean") return { error: "append must be a boolean" };
      return {
        type,
        cardIds: [...new Set(cardIds as number[])],
        shuffle: shuffle === true,
        downloadedOnly: downloadedOnly === true,
        append: append === true,
      };
    }
    case "queueRemove": {
      const { index } = body as { index?: unknown };
      return Number.isInteger(index) && (index as number) >= 0 ? { type, index: index as number } : { error: "index must be a whole number of 0 or more" };
    }
    case "queueMove": {
      const { from, to } = body as { from?: unknown; to?: unknown };
      const valid = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
      return valid(from) && valid(to) ? { type, from: from as number, to: to as number } : { error: "from and to must be whole numbers of 0 or more" };
    }
    default:
      return { error: "Unknown command" };
  }
}

export function parsePlayerName(raw: unknown): string | null {
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
        ...withPlayers([...players, { id: state.nextPlayerId, name: command.name, score: 0, phone: false, connected: false }]),
        nextPlayerId: state.nextPlayerId + 1,
      };
    case "rename":
      return players.some((p) => p.id === command.id)
        ? withPlayers(players.map((p) => (p.id === command.id ? { ...p, name: command.name } : p)))
        : state;
    case "remove": {
      if (!players.some((p) => p.id === command.id)) return state;
      const removed = withPlayers(players.filter((p) => p.id !== command.id));
      // Playback stays paused: the host decides what happens next.
      return state.buzz.playerId === command.id ? { ...removed, buzz: { ...state.buzz, playerId: null } } : removed;
    }
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

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

export type JoinPlan = { claimId: number } | { add: true } | { error: "taken" | "full" | "invalid" };

/**
 * How a phone joining with this name lands on the scoreboard: it takes over a
 * host-added or disconnected player of the same name (keeping the score), is
 * refused a name a connected phone holds, and otherwise adds a player.
 */
export function planJoin(players: readonly PartyPlayer[], rawName: unknown): JoinPlan {
  const name = parsePlayerName(rawName);
  if (!name) return { error: "invalid" };
  const match = players.find((p) => sameName(p.name, name));
  if (match) return match.phone && match.connected ? { error: "taken" } : { claimId: match.id };
  return players.length >= PLAYER_LIMIT ? { error: "full" } : { add: true };
}

/** Whether player `id` may take this name: no other player may hold it. */
export function planRename(players: readonly PartyPlayer[], id: number, rawName: unknown): { name: string } | { error: "taken" | "invalid" } {
  const name = parsePlayerName(rawName);
  if (!name) return { error: "invalid" };
  return players.some((p) => p.id !== id && sameName(p.name, name)) ? { error: "taken" } : { name };
}

/** Whether this player may buzz in right now. */
export function canBuzz(state: PartyGameState, playerId: number): boolean {
  return (
    state.buzzerEnabled &&
    state.phase === "guessing" &&
    currentPartyItem(state) !== null &&
    state.buzz.playerId === null &&
    !state.buzz.lockedOut.includes(playerId) &&
    state.scoreboard.players.some((p) => p.id === playerId)
  );
}

/** An auto-reveal timer holds off while a player is answering. */
export function timerMayReveal(state: PartyGameState): boolean {
  return state.buzz.playerId === null;
}

function judgeBuzz(state: PartyGameState, correct: boolean, now: number): PartyGameState {
  const id = state.buzz.playerId;
  if (id === null || state.phase !== "guessing") return state;
  if (correct) {
    const players = state.scoreboard.players.map((p) => (p.id === id ? { ...p, score: p.score + 1 } : p));
    const token = currentPartyItem(state)!.token;
    const awarded = state.awards[token] ?? [];
    return {
      ...state,
      scoreboard: { ...state.scoreboard, players },
      awards: { ...state.awards, [token]: awarded.includes(id) ? awarded : [...awarded, id] },
      buzz: { ...state.buzz, playerId: null, winnerId: id },
      phase: "revealed",
      revealedAtElapsed: state.position?.elapsed ?? 0,
      playing: true,
    };
  }
  const judged = { ...state, playing: true, buzz: { ...state.buzz, playerId: null, lockedOut: [...state.buzz.lockedOut, id] } };
  // The timer held its reveal for this answer; once it is wrong, it lands.
  const timerExpired = state.timer?.autoReveal === true && now >= state.timer.endsAt;
  return timerExpired ? { ...judged, phase: "revealed", revealedAtElapsed: state.position?.elapsed ?? 0 } : judged;
}

// One point per player per song, given or taken back, so a mis-tap is undone
// with a second tap rather than a hunt for the scoreboard's minus button.
function applyAward(state: PartyGameState, playerId: number, awarded: boolean): PartyGameState {
  const item = currentPartyItem(state);
  if (!item || !state.scoreboard.players.some((p) => p.id === playerId)) return state;
  const current = state.awards[item.token] ?? [];
  if (current.includes(playerId) === awarded) return state;
  const delta = awarded ? 1 : -1;
  const players = state.scoreboard.players.map((p) => (p.id === playerId ? { ...p, score: p.score + delta } : p));
  const list = awarded ? [...current, playerId] : current.filter((id) => id !== playerId);
  const buzz = !awarded && state.buzz.winnerId === playerId ? { ...state.buzz, winnerId: null } : state.buzz;
  return { ...state, scoreboard: { ...state.scoreboard, players }, awards: { ...state.awards, [item.token]: list }, buzz };
}

function applyInternal(state: PartyGameState, command: PartyInternalCommand): PartyGameState {
  const { players } = state.scoreboard;
  const withPlayers = (next: PartyPlayer[]) => ({ ...state, scoreboard: { ...state.scoreboard, players: next } });
  if (command.type === "playerJoin") {
    if (command.claimId !== null) {
      return players.some((p) => p.id === command.claimId)
        ? withPlayers(players.map((p) => (p.id === command.claimId ? { ...p, name: command.name, phone: true } : p)))
        : state;
    }
    if (players.length >= PLAYER_LIMIT) return state;
    return {
      ...withPlayers([...players, { id: state.nextPlayerId, name: command.name, score: 0, phone: true, connected: false }]),
      nextPlayerId: state.nextPlayerId + 1,
    };
  }
  if (command.type === "buzz") {
    return canBuzz(state, command.playerId)
      ? { ...state, playing: false, buzz: { ...state.buzz, playerId: command.playerId } }
      : state;
  }
  const target = players.find((p) => p.id === command.id);
  if (!target || !target.phone || target.connected === command.connected) return state;
  return withPlayers(players.map((p) => (p.id === command.id ? { ...p, connected: command.connected } : p)));
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// A move keeps a playing game playing, so Next is one tap rather than Next
// then Play; a paused game stays paused.
function atItem(state: PartyGameState, index: number, random: () => number): PartyGameState {
  return {
    ...state,
    index,
    phase: "guessing",
    startAt: 0,
    seekTo: null,
    position: null,
    // A lightning round always plays a random slice of each song.
    startFraction: state.randomStart || state.lightning ? random() : 0,
    effects: state.nextEffects ?? state.effects,
    nextEffects: null,
    revealedAtElapsed: null,
    timer: null,
    buzz: NO_BUZZ,
    summaryVisible: false,
  };
}

/**
 * Returns the next state, or the same object when the command changes
 * nothing. `loaded` is the resolved queue for a `load` command.
 */
export function applyPartyCommand(
  state: PartyGameState,
  command: PartyCommand | PartyInternalCommand,
  options: { loaded?: PartyQueueItem[]; random?: () => number; now?: () => number } = {},
): PartyGameState {
  if (command.type === "playerJoin" || command.type === "playerConnection" || command.type === "buzz") {
    const next = applyInternal(state, command);
    return next === state ? state : { ...next, version: state.version + 1 };
  }
  const hasItem = state.index >= 0 && state.index < state.queue.length;
  const random = options.random ?? Math.random;
  const now = options.now ?? Date.now;
  let next: PartyGameState = state;

  switch (command.type) {
    case "load": {
      const loaded = options.loaded ?? [];
      if (!loaded.length) return state;
      const ordered = command.shuffle ? shuffled(loaded, random) : loaded;
      if (command.append && hasItem) {
        // Adds to the end of the running game without touching the song on screen.
        const queued = new Set(state.queue.map((item) => item.cardId));
        const added = ordered.filter((item) => !queued.has(item.cardId)).slice(0, PARTY_LOAD_MAX - state.queue.length);
        if (added.length) next = { ...state, queue: [...state.queue, ...added] };
        break;
      }
      next = atItem({ ...state, queue: ordered, playing: false, awards: {} }, 0, random);
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
      // Past the last song there is nothing to play, so the game ends on its results.
      else if (hasItem && !state.summaryVisible) next = { ...state, summaryVisible: true };
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
    case "joinInfo":
      if (state.joinInfoVisible !== command.visible) next = { ...state, joinInfoVisible: command.visible };
      break;
    case "buzzer":
      if (state.buzzerEnabled !== command.enabled) next = { ...state, buzzerEnabled: command.enabled };
      break;
    case "buzzJudge":
      next = judgeBuzz(state, command.correct, now());
      break;
    case "award":
      next = applyAward(state, command.playerId, command.awarded);
      break;
    case "summary":
      if (hasItem && state.summaryVisible !== command.visible) next = { ...state, summaryVisible: command.visible };
      break;
    case "queueRemove":
      // Only songs still to come: the current one moves on with Next.
      if (hasItem && command.index > state.index && command.index < state.queue.length) {
        const removed = state.queue[command.index]!;
        const { [removed.token]: _dropped, ...awards } = state.awards;
        next = { ...state, queue: state.queue.filter((_, i) => i !== command.index), awards };
      }
      break;
    case "queueMove":
      if (
        hasItem &&
        command.from !== command.to &&
        Math.min(command.from, command.to) > state.index &&
        Math.max(command.from, command.to) < state.queue.length
      ) {
        const queue = [...state.queue];
        const [moved] = queue.splice(command.from, 1);
        queue.splice(command.to, 0, moved!);
        next = { ...state, queue };
      }
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
        next = { ...state, phase: "revealed", revealedAtElapsed: state.position?.elapsed ?? 0, buzz: { ...state.buzz, playerId: null } };
      }
      break;
    case "clear":
      if (state.index !== -1 || state.queue.length) {
        next = initialPartyState(state.version, state.randomStart, state.effects, state.lightning, {
          scoreboard: state.scoreboard,
          nextPlayerId: state.nextPlayerId,
          music: state.music,
          joinInfoVisible: state.joinInfoVisible,
          buzzerEnabled: state.buzzerEnabled,
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

export function toDisplayState(state: PartyGameState, join: PartyJoinInfo | null = null): PartyDisplayState {
  const item = currentPartyItem(state);
  return {
    version: state.version,
    phase: state.phase,
    item: item
      ? { token: item.token, kind: item.clip.kind, number: state.index + 1, total: state.queue.length }
      : null,
    upcoming: item ? state.queue.slice(state.index + 1, state.index + 1 + PARTY_LOOKAHEAD).map((next) => next.token) : [],
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
    // Always on the idle screen, where people join; the host can hide the
    // small in-game chip.
    join: join && (!item || state.joinInfoVisible) ? join : null,
    buzz: { answering: playerName(state, state.buzz.playerId), winner: playerName(state, state.buzz.winnerId) },
    summary: state.summaryVisible ? buildSummary(state) : null,
  };
}

/**
 * The results screen: standings, and the songs already behind the game. The
 * current song counts only once revealed, so the screen never shows an answer
 * early.
 */
export function buildSummary(state: PartyGameState): PartySummary {
  const sorted = [...state.scoreboard.players].sort((a, b) => b.score - a.score);
  const standings = sorted.map((p) => ({
    rank: sorted.findIndex((other) => other.score === p.score) + 1,
    name: p.name,
    score: p.score,
  }));
  const playedCount = state.index < 0 ? 0 : state.index + (state.phase === "revealed" ? 1 : 0);
  const songs = state.queue.slice(0, playedCount).map((item, i) => ({
    number: i + 1,
    anime: item.answer.animeTitleEnglish,
    song: item.answer.songTitle,
    scorers: (state.awards[item.token] ?? []).map((id) => playerName(state, id)).filter((name) => name !== null),
  }));
  return { standings, songs, played: playedCount, total: state.queue.length };
}

function playerName(state: PartyGameState, id: number | null): string | null {
  return id === null ? null : state.scoreboard.players.find((p) => p.id === id)?.name ?? null;
}

// Built from scratch rather than trimmed from another view, so nothing the
// phone must not see can ride along by accident.
export function toPlayerState(state: PartyGameState, playerId: number): PartyPlayerState {
  const item = currentPartyItem(state);
  const me = state.scoreboard.players.find((p) => p.id === playerId);
  return {
    version: state.version,
    me: me ? { id: me.id, name: me.name, score: me.score } : null,
    phase: state.phase,
    song: item ? { number: state.index + 1, total: state.queue.length } : null,
    players: [...state.scoreboard.players].sort((a, b) => b.score - a.score).map((p) => ({ name: p.name, score: p.score })),
    buzzer: {
      enabled: state.buzzerEnabled,
      canBuzz: canBuzz(state, playerId),
      answering: playerName(state, state.buzz.playerId),
      answeringIsMe: state.buzz.playerId === playerId,
      lockedOut: state.buzz.lockedOut.includes(playerId),
      winner: playerName(state, state.buzz.winnerId),
    },
    answer:
      item && state.phase === "revealed"
        ? { anime: item.answer.animeTitleEnglish, song: item.answer.songTitle, artist: item.answer.artistName }
        : null,
  };
}

export function toHostState(state: PartyGameState): PartyHostState {
  const item = currentPartyItem(state);
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
    joinInfoVisible: state.joinInfoVisible,
    buzzerEnabled: state.buzzerEnabled,
    buzz: state.buzz,
    currentAwards: (item && state.awards[item.token]) ?? [],
    summaryVisible: state.summaryVisible,
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
  if (!lightning || !item || !position || position.token !== item.token || !state.playing || !position.playing || position.blocked) return null;

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
