import type { CardWithDetails } from "./cards.ts";
import { type ClipSource, isClipUrlAllowed } from "./clipSource.ts";
import { ENDLESS_DIFFICULTIES, type EndlessDifficulty } from "./partyEndless.ts";
import { EMPTY_DETAILS, lightningHints, type PartyAnimeDetails, type PartyHints } from "./partyLightning.ts";

export type PartyPhase = "idle" | "guessing" | "revealed";
export type PartyPicture = "video" | "blackout" | "cover" | "bubbles";
export const LIGHTNING_MODES = ["regular", "blind", "peek", "cover", "clues", "tags", "title"] as const;
export type PartyLightningMode = (typeof LIGHTNING_MODES)[number];
export interface PartyEndless {
  difficulty: EndlessDifficulty;
  downloadedOnly: boolean;
  /** Draw from AnisongDB's whole catalog instead of the library's cards. */
  outsideLibrary: boolean;
}

/** Which parts of the answer the reveal shows. */
export interface PartyRevealFields {
  anime: boolean;
  artist: boolean;
  song: boolean;
  slot: boolean;
}
export const ALL_REVEAL_FIELDS: PartyRevealFields = { anime: true, artist: true, song: true, slot: true };
/** With auto-advance on, the answer shows this many seconds before the clip ends. */
export const AUTO_REVEAL_LEAD_SECONDS = 5;

/** A hint mode the host turns on for the current song only, with no timed round around it. */
export interface PartyLive {
  mode: Exclude<PartyLightningMode, "regular">;
  guessSeconds: number;
  /** Play time when it was turned on; hints and the picture count up from here. */
  offset: number;
}

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
  /** Members share their team's total on the scoreboard. */
  teamId: number | null;
}
export interface PartyTeam {
  id: number;
  name: string;
}
/** A scoreboard line: one player, or a team with its members' combined score. */
export interface PartyScoreRow {
  id: number;
  name: string;
  score: number;
  members?: string[];
}
/** Points for the current song are multiplied; with risk, a wrong buzz costs the same multiple. */
export interface PartyStake {
  multiplier: number;
  risk: boolean;
  /** Whose points count; null means whoever scores. */
  playerId: number | null;
}
export const TEAM_LIMIT = 10;
export interface PartyScoreboard {
  players: PartyPlayer[];
  teams: PartyTeam[];
  nextTeamId: number;
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
/** A player's net points on the current song, as the display lists them (feature 91a). */
export interface PartyRoundPoint {
  id: number;
  name: string;
  points: number;
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
  blocked: boolean;
  // Seconds played since the song's own start position; lightning rounds
  // time their reveal and advance from it.
  elapsed: number;
  /** The clip played to its end; the store may then move the game on. */
  ended?: boolean;
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
  skipSeq: number;
  position: PartyPosition | null;
  randomStart: boolean;
  startFraction: number;
  effects: PartyEffects;
  nextEffects: PartyEffects | null;
  lightning: PartyLightning | null;
  live: PartyLive | null;
  choices: string[] | null;
  // Which option each phone player picked (player id to option index) for the current song.
  choicePicks: Record<number, number>;
  stake: PartyStake | null;
  revealedAtElapsed: number | null;
  timer: PartyTimer | null;
  scoreboard: PartyScoreboard;
  nextPlayerId: number;
  banner: PartyBanner | null;
  music: PartyMusic;
  songVolume: number;
  // The display's corner chip with the player join address.
  joinInfoVisible: boolean;
  buzzerEnabled: boolean;
  endless: PartyEndless | null;
  revealFields: PartyRevealFields;
  autoAdvance: boolean;
  buzz: PartyBuzz;
  // Who scored each song, by queue item token (feature 90c).
  awards: Record<string, number[]>;
  // Points each award was worth, so taking one back returns exactly that.
  awardValue: Record<string, Record<number, number>>;
  // Net points per player id on the current song only (feature 91a).
  roundPoints: Record<number, number>;
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
  | { type: "score"; op: "show"; visible: boolean }
  | { type: "score"; op: "teamAdd"; name: string }
  | { type: "score"; op: "teamRemove"; id: number }
  | { type: "score"; op: "assign"; id: number; teamId: number | null };
export type PartyCommand =
  | { type: "load"; cardIds: number[]; shuffle?: boolean; downloadedOnly?: boolean; append?: boolean }
  | { type: "queueRemove"; index: number }
  | { type: "queueMove"; from: number; to: number }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; seconds: number; skip?: boolean }
  | { type: "next" }
  | { type: "previous" }
  | { type: "reveal" }
  | { type: "clear" }
  | { type: "jump"; index: number }
  | { type: "settings"; randomStart: boolean }
  | { type: "effects"; target: "current" | "next"; effects: PartyEffects | null }
  | { type: "lightning"; config: PartyLightning | null }
  | { type: "live"; config: { mode: PartyLive["mode"]; guessSeconds: number } | null }
  | { type: "choices"; enabled: boolean }
  | { type: "stake"; config: PartyStake | null }
  | { type: "endless"; config: PartyEndless | null }
  | { type: "revealFields"; fields: PartyRevealFields }
  | { type: "autoAdvance"; enabled: boolean }
  | { type: "queueReroll"; index: number }
  | { type: "timer"; seconds: number; autoReveal: boolean }
  | { type: "timerStop" }
  | PartyScoreCommand
  | { type: "banner"; text: string | null }
  | { type: "music"; enabled: boolean; volume: number }
  | { type: "songVolume"; volume: number }
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
  | { type: "buzz"; playerId: number }
  | { type: "choicePick"; playerId: number; index: number };
export interface PartyJoinInfo {
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
  skipSeq: number;
  startFraction: number;
  effects: PartyEffects;
  lightning: { mode: PartyLightningMode; guessSeconds: number; offset: number; hints: PartyHints } | null;
  /** Anime titles to pick from; hidden once the answer is revealed. */
  choices: string[] | null;
  stake: { multiplier: number; risk: boolean; player: string | null } | null;
  timer: PartyTimer | null;
  scoreboard: PartyScoreRow[] | null;
  banner: PartyBanner | null;
  music: PartyMusic;
  songVolume: number;
  answer: PartyAnswer | null;
  join: PartyJoinInfo | null;
  buzz: { answering: string | null };
  roundPoints: PartyRoundPoint[];
  summary: PartySummary | null;
}
/** Sent to a joined phone: never an answer, clip token, or card id. */
export interface PartyPlayerState {
  version: number;
  me: { id: number; name: string; score: number } | null;
  phase: PartyPhase;
  song: { number: number; total: number } | null;
  players: { name: string; score: number }[];
  /** Multiple choice for this phone; the right one is named only after the reveal. */
  choices: { options: string[]; picked: number | null; correct: number | null } | null;
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
  live: PartyLive | null;
  choices: string[] | null;
  choicePicks: Record<number, number>;
  stake: PartyStake | null;
  timer: PartyTimer | null;
  scoreboard: PartyScoreboard;
  banner: PartyBanner | null;
  music: PartyMusic;
  songVolume: number;
  joinInfoVisible: boolean;
  buzzerEnabled: boolean;
  endless: PartyEndless | null;
  revealFields: PartyRevealFields;
  autoAdvance: boolean;
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
const PICTURES: readonly PartyPicture[] = ["video", "blackout", "cover", "bubbles"];
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
  if (!PICTURES.includes(picture as PartyPicture)) return { error: "picture must be 'video', 'blackout', 'cover', or 'bubbles'" };
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
  kept: Pick<PartyGameState, "scoreboard" | "nextPlayerId" | "music" | "songVolume" | "joinInfoVisible" | "buzzerEnabled" | "endless" | "revealFields" | "autoAdvance" | "skipSeq"> = {
    scoreboard: { players: [], teams: [], nextTeamId: 1, visible: false },
    nextPlayerId: 1,
    music: DEFAULT_MUSIC,
    songVolume: 1,
    joinInfoVisible: true,
    buzzerEnabled: false,
    endless: null,
    revealFields: ALL_REVEAL_FIELDS,
    autoAdvance: true,
    skipSeq: 0,
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
    skipSeq: kept.skipSeq,
    position: null,
    randomStart,
    startFraction: 0,
    effects,
    nextEffects: null,
    lightning,
    live: null,
    choices: null,
    choicePicks: {},
    stake: null,
    revealedAtElapsed: null,
    timer: null,
    banner: null,
    buzz: NO_BUZZ,
    awards: {},
    awardValue: {},
    roundPoints: {},
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
    case "live": {
      const { config } = body as { config?: unknown };
      if (config === null) return { type, config: null };
      const { mode, guessSeconds } = (config ?? {}) as { mode?: unknown; guessSeconds?: unknown };
      if (!LIGHTNING_MODES.includes(mode as PartyLightningMode) || mode === "regular") return { error: "mode must be a lightning hint mode" };
      if (typeof guessSeconds !== "number" || !Number.isFinite(guessSeconds)) return { error: "guessSeconds must be a number" };
      return { type, config: { mode: mode as PartyLive["mode"], guessSeconds: Math.round(clamp(guessSeconds, 5, 60)) } };
    }
    case "stake": {
      const { config } = body as { config?: unknown };
      if (config === null) return { type, config: null };
      const { multiplier, risk, playerId } = (config ?? {}) as { multiplier?: unknown; risk?: unknown; playerId?: unknown };
      if (!Number.isInteger(multiplier) || (multiplier as number) < 2 || (multiplier as number) > 4) return { error: "multiplier must be 2, 3 or 4" };
      if (typeof risk !== "boolean") return { error: "risk must be a boolean" };
      if (playerId !== null && (!Number.isInteger(playerId) || (playerId as number) <= 0)) return { error: "playerId must be a player id or null" };
      return { type, config: { multiplier: multiplier as number, risk, playerId: playerId as number | null } };
    }
    case "choices": {
      const { enabled } = body as { enabled?: unknown };
      return typeof enabled === "boolean" ? { type, enabled } : { error: "enabled must be a boolean" };
    }
    case "endless": {
      const { config } = body as { config?: unknown };
      if (config === null) return { type, config: null };
      const { difficulty, downloadedOnly, outsideLibrary } = (config ?? {}) as {
        difficulty?: unknown;
        downloadedOnly?: unknown;
        outsideLibrary?: unknown;
      };
      if (!ENDLESS_DIFFICULTIES.includes(difficulty as EndlessDifficulty)) return { error: "difficulty must be easy, medium, hard or random" };
      if (typeof downloadedOnly !== "boolean") return { error: "downloadedOnly must be a boolean" };
      if (outsideLibrary !== undefined && typeof outsideLibrary !== "boolean") return { error: "outsideLibrary must be a boolean" };
      return { type, config: { difficulty: difficulty as EndlessDifficulty, downloadedOnly, outsideLibrary: outsideLibrary === true } };
    }
    case "revealFields": {
      const { fields } = body as { fields?: Record<string, unknown> };
      const keys = ["anime", "artist", "song", "slot"] as const;
      if (!fields || !keys.every((key) => typeof fields[key] === "boolean")) return { error: "fields needs anime, artist, song and slot booleans" };
      return { type, fields: { anime: fields.anime as boolean, artist: fields.artist as boolean, song: fields.song as boolean, slot: fields.slot as boolean } };
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
    case "songVolume": {
      const { volume } = body as { volume?: unknown };
      if (typeof volume !== "number" || !Number.isFinite(volume)) return { error: "volume must be a number" };
      return { type, volume: clamp(volume, 0, 1) };
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
      const { skip } = body as { skip?: unknown };
      if (skip !== undefined && typeof skip !== "boolean") return { error: "skip must be a boolean" };
      return skip === true ? { type, seconds, skip } : { type, seconds };
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
    case "autoAdvance": {
      const { enabled } = body as { enabled?: unknown };
      return typeof enabled === "boolean" ? { type, enabled } : { error: "enabled must be a boolean" };
    }
    case "queueReroll": {
      const { index } = body as { index?: unknown };
      return Number.isInteger(index) && (index as number) >= 0 ? { type, index: index as number } : { error: "index must be a whole number of 0 or more" };
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
    case "teamAdd": {
      const name = parsePlayerName(body.name);
      return name ? { type: "score", op: "teamAdd", name } : { error: `name must be 1-${PLAYER_NAME_MAX} characters` };
    }
    case "teamRemove":
      return isId(body.id) ? { type: "score", op: "teamRemove", id: body.id } : { error: "id must be a team id" };
    case "assign":
      if (!isId(body.id)) return { error: "id must be a player id" };
      if (body.teamId !== null && !isId(body.teamId)) return { error: "teamId must be a team id or null" };
      return { type: "score", op: "assign", id: body.id, teamId: body.teamId as number | null };
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
        ...withPlayers([...players, { id: state.nextPlayerId, name: command.name, score: 0, phone: false, connected: false, teamId: null }]),
        nextPlayerId: state.nextPlayerId + 1,
      };
    case "rename":
      return players.some((p) => p.id === command.id)
        ? withPlayers(players.map((p) => (p.id === command.id ? { ...p, name: command.name } : p)))
        : state;
    case "remove": {
      if (!players.some((p) => p.id === command.id)) return state;
      const { [command.id]: _dropped, ...roundPoints } = state.roundPoints;
      const removed = { ...withPlayers(players.filter((p) => p.id !== command.id)), roundPoints };
      // Playback stays paused: the host decides what happens next.
      return state.buzz.playerId === command.id ? { ...removed, buzz: { ...state.buzz, playerId: null } } : removed;
    }
    case "adjust": {
      if (!players.some((p) => p.id === command.id) || command.delta === 0) return state;
      const adjusted = withPlayers(players.map((p) => (p.id === command.id ? { ...p, score: p.score + command.delta } : p)));
      // Points given between songs belong to no round.
      return currentPartyItem(state)
        ? { ...adjusted, roundPoints: addRoundPoints(state.roundPoints, command.id, command.delta) }
        : adjusted;
    }
    case "reset":
      return players.some((p) => p.score !== 0)
        ? { ...withPlayers(players.map((p) => ({ ...p, score: 0 }))), roundPoints: {} }
        : state;
    case "teamAdd": {
      const { teams } = state.scoreboard;
      if (teams.length >= TEAM_LIMIT || teams.some((t) => sameName(t.name, command.name))) return state;
      return { ...state, scoreboard: { ...state.scoreboard, teams: [...teams, { id: state.scoreboard.nextTeamId, name: command.name }], nextTeamId: state.scoreboard.nextTeamId + 1 } };
    }
    case "teamRemove": {
      const { teams } = state.scoreboard;
      if (!teams.some((t) => t.id === command.id)) return state;
      const freed = players.map((p) => (p.teamId === command.id ? { ...p, teamId: null } : p));
      return { ...state, scoreboard: { ...state.scoreboard, teams: teams.filter((t) => t.id !== command.id), players: freed } };
    }
    case "assign": {
      const target = players.find((p) => p.id === command.id);
      if (!target || target.teamId === command.teamId) return state;
      if (command.teamId !== null && !state.scoreboard.teams.some((t) => t.id === command.teamId)) return state;
      return withPlayers(players.map((p) => (p.id === command.id ? { ...p, teamId: command.teamId } : p)));
    }
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

/** What a point is worth to this player on the current song. */
export function pointsFor(state: PartyGameState, playerId: number): number {
  return stakeApplies(state, playerId) ? state.stake!.multiplier : 1;
}

function stakeApplies(state: PartyGameState, playerId: number): boolean {
  return state.stake !== null && (state.stake.playerId === null || state.stake.playerId === playerId);
}

function judgeBuzz(state: PartyGameState, correct: boolean, now: number): PartyGameState {
  const id = state.buzz.playerId;
  if (id === null || state.phase !== "guessing") return state;
  const bump = (delta: number) => state.scoreboard.players.map((p) => (p.id === id ? { ...p, score: p.score + delta } : p));
  if (correct) {
    const points = pointsFor(state, id);
    const token = currentPartyItem(state)!.token;
    const awarded = state.awards[token] ?? [];
    return {
      ...state,
      scoreboard: { ...state.scoreboard, players: bump(points) },
      awards: { ...state.awards, [token]: awarded.includes(id) ? awarded : [...awarded, id] },
      awardValue: { ...state.awardValue, [token]: { ...state.awardValue[token], [id]: points } },
      roundPoints: addRoundPoints(state.roundPoints, id, points),
      buzz: { ...state.buzz, playerId: null, winnerId: id },
      phase: "revealed",
      revealedAtElapsed: state.position?.elapsed ?? 0,
      playing: true,
    };
  }
  // Hyper Risk: a wrong buzz from the staked player costs the same multiple.
  const penalty = state.stake?.risk && stakeApplies(state, id) ? state.stake.multiplier : 0;
  const base = penalty
    ? { ...state, scoreboard: { ...state.scoreboard, players: bump(-penalty) }, roundPoints: addRoundPoints(state.roundPoints, id, -penalty) }
    : state;
  const judged = { ...base, playing: true, buzz: { ...state.buzz, playerId: null, lockedOut: [...state.buzz.lockedOut, id] } };
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
  const delta = awarded ? pointsFor(state, playerId) : -(state.awardValue[item.token]?.[playerId] ?? 1);
  const players = state.scoreboard.players.map((p) => (p.id === playerId ? { ...p, score: p.score + delta } : p));
  const list = awarded ? [...current, playerId] : current.filter((id) => id !== playerId);
  const buzz = !awarded && state.buzz.winnerId === playerId ? { ...state.buzz, winnerId: null } : state.buzz;
  return {
    ...state,
    scoreboard: { ...state.scoreboard, players },
    awards: { ...state.awards, [item.token]: list },
    awardValue: awarded ? { ...state.awardValue, [item.token]: { ...state.awardValue[item.token], [playerId]: delta } } : state.awardValue,
    roundPoints: addRoundPoints(state.roundPoints, playerId, delta),
    buzz,
  };
}

function addRoundPoints(roundPoints: Record<number, number>, playerId: number, delta: number): Record<number, number> {
  const { [playerId]: current = 0, ...rest } = roundPoints;
  const total = current + delta;
  return total === 0 ? rest : { ...rest, [playerId]: total };
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
      ...withPlayers([...players, { id: state.nextPlayerId, name: command.name, score: 0, phone: true, connected: false, teamId: null }]),
      nextPlayerId: state.nextPlayerId + 1,
    };
  }
  if (command.type === "buzz") {
    return canBuzz(state, command.playerId)
      ? { ...state, playing: false, buzz: { ...state.buzz, playerId: command.playerId } }
      : state;
  }
  if (command.type === "choicePick") {
    const open = state.choices !== null && state.phase === "guessing" && state.choicePicks[command.playerId] === undefined;
    const valid = Number.isInteger(command.index) && command.index >= 0 && command.index < (state.choices?.length ?? 0);
    return open && valid && players.some((p) => p.id === command.playerId)
      ? { ...state, choicePicks: { ...state.choicePicks, [command.playerId]: command.index } }
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
    live: null,
    choices: null,
    choicePicks: {},
    stake: null,
    revealedAtElapsed: null,
    timer: null,
    buzz: NO_BUZZ,
    roundPoints: {},
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
  options: { loaded?: PartyQueueItem[]; random?: () => number; now?: () => number; choices?: string[] } = {},
): PartyGameState {
  if (command.type === "playerJoin" || command.type === "playerConnection" || command.type === "buzz" || command.type === "choicePick") {
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
      if (hasItem) {
        next = { ...state, seekTo: command.seconds, seekSeq: state.seekSeq + 1 };
        if (command.skip) next = { ...next, skipSeq: state.skipSeq + 1 };
      }
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
    case "live":
      if (hasItem && state.phase === "guessing") {
        next = { ...state, live: command.config ? { ...command.config, offset: state.position?.elapsed ?? 0 } : null };
      }
      break;
    case "stake":
      if (hasItem) next = { ...state, stake: command.config };
      break;
    case "choices":
      if (hasItem && state.phase === "guessing") next = { ...state, choices: command.enabled ? (options.choices ?? null) : null, choicePicks: {} };
      break;
    case "endless":
      next = { ...state, endless: command.config };
      break;
    case "revealFields":
      next = { ...state, revealFields: command.fields };
      break;
    case "autoAdvance":
      if (state.autoAdvance !== command.enabled) next = { ...state, autoAdvance: command.enabled };
      break;
    case "queueReroll": {
      // The store picks the replacement; without one the song stays.
      const replacement = options.loaded?.[0];
      if (hasItem && replacement && command.index > state.index && command.index < state.queue.length) {
        const replaced = state.queue[command.index]!;
        const { [replaced.token]: _dropped, ...awards } = state.awards;
        const queue = [...state.queue];
        queue[command.index] = replacement;
        next = { ...state, queue, awards };
      }
      break;
    }
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
    case "songVolume":
      if (state.songVolume !== command.volume) next = { ...state, songVolume: command.volume };
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
          songVolume: state.songVolume,
          joinInfoVisible: state.joinInfoVisible,
          buzzerEnabled: state.buzzerEnabled,
          // End game ends an endless queue too; otherwise it would refill at once.
          endless: null,
          revealFields: state.revealFields,
          autoAdvance: state.autoAdvance,
          skipSeq: state.skipSeq,
        });
      }
      break;
  }

  return next === state ? state : { ...settleChoices(state, next), version: state.version + 1 };
}

/** When a song with multiple choice gets revealed, everyone who picked the right title scores. */
function settleChoices(before: PartyGameState, after: PartyGameState): PartyGameState {
  const item = currentPartyItem(after);
  if (before.phase === "revealed" || after.phase !== "revealed" || !after.choices || !item) return after;
  let settled = after;
  for (const [id, index] of Object.entries(after.choicePicks)) {
    if (after.choices[index] === item.answer.animeTitleEnglish) settled = applyAward(settled, Number(id), true);
  }
  return settled;
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

function displayLightning(state: PartyGameState, item: PartyQueueItem | null): PartyDisplayState["lightning"] {
  const round = state.lightning ?? state.live;
  if (!round) return null;
  const offset = state.lightning ? 0 : state.live!.offset;
  return {
    mode: round.mode,
    guessSeconds: round.guessSeconds,
    offset,
    hints: item ? lightningHints(item, round.mode, hintElapsed(state) - offset, round.guessSeconds) : null,
  };
}

/** Hidden parts are blanked here, so they never reach the display at all. */
export function maskAnswer(answer: PartyAnswer, fields: PartyRevealFields): PartyAnswer {
  return {
    animeTitleEnglish: fields.anime ? answer.animeTitleEnglish : "",
    animeTitleRomaji: fields.anime ? answer.animeTitleRomaji : "",
    animeTitleNative: fields.anime ? answer.animeTitleNative : "",
    songTitle: fields.song ? answer.songTitle : "",
    artistName: fields.artist ? answer.artistName : "",
    themeSlot: fields.slot ? answer.themeSlot : "",
    coverImageUrl: fields.anime ? answer.coverImageUrl : null,
  };
}

function maskPhoneAnswer(answer: PartyAnswer, fields: PartyRevealFields): { anime: string; song: string; artist: string } {
  return {
    anime: fields.anime ? answer.animeTitleEnglish : "",
    song: fields.song ? answer.songTitle : "",
    artist: fields.artist ? answer.artistName : "",
  };
}

/** True once a guessing song has [AUTO_REVEAL_LEAD_SECONDS] or less left and nothing is holding the reveal. */
export function shouldRevealEarly(state: PartyGameState): boolean {
  const position = state.position;
  if (!state.autoAdvance || state.lightning || state.phase !== "guessing" || state.buzz.playerId !== null) return false;
  if (!position || !position.playing || position.duration === null || !(position.duration > 0)) return false;
  return position.duration - position.currentTime <= AUTO_REVEAL_LEAD_SECONDS;
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
    skipSeq: state.skipSeq,
    startFraction: state.startFraction,
    effects: state.effects,
    lightning: displayLightning(state, item),
    choices: state.phase === "revealed" ? null : state.choices,
    timer: state.timer,
    scoreboard: state.scoreboard.visible ? scoreRows(state) : null,
    stake: state.stake
      ? { multiplier: state.stake.multiplier, risk: state.stake.risk, player: playerName(state, state.stake.playerId) }
      : null,
    banner: state.banner,
    music: state.music,
    songVolume: state.songVolume,
    answer: item && state.phase === "revealed" ? maskAnswer(item.answer, state.revealFields) : null,
    // Always on the idle screen, where people join; the host can hide the
    // small in-game chip.
    join: join && (!item || state.joinInfoVisible) ? join : null,
    buzz: { answering: playerName(state, state.buzz.playerId) },
    roundPoints: item ? listRoundPoints(state) : [],
    summary: state.summaryVisible ? buildSummary(state) : null,
  };
}

/**
 * The results screen: standings, and the songs already behind the game. The
 * current song counts only once revealed, so the screen never shows an answer
 * early.
 */
/** Teams (summed over their members) and unteamed players, best first. */
export function scoreRows(state: PartyGameState): PartyScoreRow[] {
  const { players, teams } = state.scoreboard;
  const rows: PartyScoreRow[] = teams.map((team) => {
    const members = players.filter((p) => p.teamId === team.id);
    return { id: -team.id, name: team.name, score: members.reduce((sum, p) => sum + p.score, 0), members: members.map((p) => p.name) };
  });
  const known = new Set(teams.map((t) => t.id));
  for (const p of players) if (p.teamId === null || !known.has(p.teamId)) rows.push({ id: p.id, name: p.name, score: p.score });
  return rows.sort((a, b) => b.score - a.score);
}

export function buildSummary(state: PartyGameState): PartySummary {
  const sorted = scoreRows(state);
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

function listRoundPoints(state: PartyGameState): PartyRoundPoint[] {
  return state.scoreboard.players
    .filter((p) => state.roundPoints[p.id])
    .map((p) => ({ id: p.id, name: p.name, points: state.roundPoints[p.id]! }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
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
    choices: state.choices
      ? {
          options: state.choices,
          picked: state.choicePicks[playerId] ?? null,
          correct: item && state.phase === "revealed" ? state.choices.indexOf(item.answer.animeTitleEnglish) : null,
        }
      : null,
    answer:
      item && state.phase === "revealed"
        ? maskPhoneAnswer(item.answer, state.revealFields)
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
    live: state.live,
    choices: state.choices,
    choicePicks: state.choicePicks,
    stake: state.stake,
    timer: state.timer,
    scoreboard: state.scoreboard,
    banner: state.banner,
    music: state.music,
    songVolume: state.songVolume,
    joinInfoVisible: state.joinInfoVisible,
    buzzerEnabled: state.buzzerEnabled,
    endless: state.endless,
    revealFields: state.revealFields,
    autoAdvance: state.autoAdvance,
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
