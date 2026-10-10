import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { getCardsByIds } from "./cards.ts";
import { fetchRandomSongs, toThemeSlot, type AnisongRandomSong, type AnisongSongResult } from "../lib/anisongdb.ts";
import { getClipSource, getIncludeInsertSongs, getPlaybackMode, isPathWithinLibrary } from "./mediaLibrary.ts";
import { resolveCachedPath } from "./streamCache.ts";
import { pickChoices, type ChoiceCandidate } from "./partyChoices.ts";
import { ENDLESS_AHEAD, ENDLESS_BATCH, pickEndlessBatch } from "./partyEndless.ts";
import { listEndlessCandidates } from "./partySources.ts";
import { EMPTY_DETAILS, type PartyAnimeDetails } from "./partyLightning.ts";
import { createPlayerRegistry } from "./partyPlayers.ts";
import {
  applyPartyCommand,
  currentPartyItem,
  initialPartyState,
  lightningStep,
  PARTY_LOAD_MAX,
  PARTY_LOOKAHEAD,
  listPartyClips,
  nextPartyClip,
  pickPartyClip,
  shouldRevealEarly,
  timerMayReveal,
  toQueueItem,
  type PartyCommand,
  type PartyGameState,
  type PartyJoinInfo,
  type PartyPosition,
  type PartyQueueItem,
} from "./partyGame.ts";

// One game per party process, in memory: a restart ends it.
let state: PartyGameState = initialPartyState();
const listeners = new Set<(state: PartyGameState) => void>();

export function getPartyState(): PartyGameState {
  return state;
}

export function onPartyChange(listener: (state: PartyGameState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// A remote clip plays only once the stream cache holds all of it, so the
// current song and the ones the display buffers ahead are fetched as soon as
// the game moves. Failures are the clip route's to report.
function prefetchAround(current: PartyGameState): void {
  for (const item of current.queue.slice(Math.max(current.index, 0), current.index + 1 + PARTY_LOOKAHEAD)) {
    if (item.clip.source.type === "remote") void resolveCachedPath(item.clip.source.url).catch(() => {});
  }
}

let timerHandle: ReturnType<typeof setTimeout> | null = null;

// An auto-reveal timer fires on the server, so it lands even if the host's
// phone sleeps. Any new timer, a stop, or a move replaces the timer object,
// which is what the check below compares against.
function scheduleTimer(): void {
  if (timerHandle) clearTimeout(timerHandle);
  timerHandle = null;
  const timer = state.timer;
  if (!timer?.autoReveal) return;
  timerHandle = setTimeout(() => {
    timerHandle = null;
    // A player answering holds the reveal; judging them Wrong lands it.
    if (state.timer === timer && state.phase === "guessing" && timerMayReveal(state)) {
      commit(applyPartyCommand(state, { type: "reveal" }));
    }
  }, Math.max(0, timer.endsAt - Date.now()));
}

let toppingUp = false;
let fetchingCatalog = false;

// A song straight from AnisongDB has no card behind it, so its id is the
// negated AMQ song id: unique, and never colliding with a library card.
interface CatalogSong {
  annSongId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  animeEnglish: string;
  animeRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

function catalogItem(song: CatalogSong): PartyQueueItem | null {
  const clip = pickPartyClip(
    { localVideoPath: null, localAudioPath: null, animethemesVideoUrl: song.videoUrl, animethemesAudioUrl: song.audioUrl },
    { clipSource: getClipSource(), playbackMode: getPlaybackMode() },
  );
  if (!clip) return null;
  return {
    token: randomBytes(12).toString("hex"),
    cardId: -song.annSongId,
    clip,
    details: EMPTY_DETAILS,
    answer: {
      animeTitleEnglish: song.animeEnglish,
      animeTitleRomaji: song.animeRomaji,
      animeTitleNative: song.animeRomaji,
      songTitle: song.songTitle,
      artistName: song.artistName,
      themeSlot: song.themeSlot,
      coverImageUrl: null,
    },
  };
}

function fromRandom(song: AnisongRandomSong): PartyQueueItem | null {
  const themeSlot = toThemeSlot(song.songType) ?? (getIncludeInsertSongs() ? `IN-${song.annSongId}` : null);
  return themeSlot ? catalogItem({ ...song, themeSlot }) : null;
}

// The last catalog search, so adding a result needs no second AnisongDB call.
let lastCatalogSearch = new Map<number, CatalogSong>();

export function rememberCatalogSearch(results: AnisongSongResult[]): void {
  lastCatalogSearch = new Map(
    results.map((song) => [
      song.annSongId,
      { ...song, artistName: song.artistName ?? "Unknown artist", animeEnglish: song.animeTitleRomaji, animeRomaji: song.animeTitleRomaji },
    ]),
  );
}

/** Adds songs from the last catalog search to the queue; the count actually added. */
export function addCatalogSongs(annSongIds: number[]): number {
  const queued = new Set(state.queue.map((item) => item.cardId));
  const items = annSongIds
    .map((id) => lastCatalogSearch.get(id))
    .map((song) => (song ? catalogItem(song) : null))
    .filter((item): item is PartyQueueItem => item !== null && !queued.has(item.cardId))
    .slice(0, Math.max(0, PARTY_LOAD_MAX - state.queue.length));
  if (!items.length) return 0;
  commit(
    applyPartyCommand(
      state,
      { type: "load", cardIds: items.map((item) => item.cardId), shuffle: false, downloadedOnly: false, append: true },
      { loaded: items },
    ),
  );
  return items.length;
}

async function topUpCatalog(hasGame: boolean): Promise<void> {
  fetchingCatalog = true;
  try {
    const queued = new Set(state.queue.map((item) => item.cardId));
    const items = (await fetchRandomSongs(ENDLESS_BATCH * 2))
      .map(fromRandom)
      .filter((item): item is PartyQueueItem => item !== null && !queued.has(item.cardId))
      .slice(0, ENDLESS_BATCH);
    // The host may have stopped endless or switched source while this was out.
    if (!items.length || !state.endless?.outsideLibrary) return;
    const stillHasGame = state.index >= 0 && state.index < state.queue.length;
    commit(
      applyPartyCommand(
        state,
        { type: "load", cardIds: items.map((item) => item.cardId), shuffle: false, downloadedOnly: false, append: hasGame && stillHasGame },
        { loaded: items },
      ),
    );
  } catch {
    // AnisongDB being down just means no new songs this round; the next change retries.
  } finally {
    fetchingCatalog = false;
  }
}

// An endless queue keeps a few songs ready ahead of the current one. It runs
// after every change, so a skip, a jump or a removal refills it too.
function topUpEndless(): void {
  const config = state.endless;
  if (!config || toppingUp) return;
  const hasGame = state.index >= 0 && state.index < state.queue.length;
  const upcoming = hasGame ? state.queue.length - 1 - state.index : 0;
  if (hasGame && upcoming >= ENDLESS_AHEAD) return;
  if (state.queue.length >= PARTY_LOAD_MAX) return;
  if (config.outsideLibrary) {
    if (!fetchingCatalog) void topUpCatalog(hasGame);
    return;
  }
  toppingUp = true;
  try {
    // A few spare picks cover songs the clip settings drop.
    const cardIds = pickEndlessBatch({
      candidates: listEndlessCandidates(),
      difficulty: config.difficulty,
      downloadedOnly: config.downloadedOnly,
      queue: state.queue.map((item) => item.cardId),
      count: ENDLESS_BATCH + 4,
    });
    if (!cardIds.length) return;
    runPartyCommand({ type: "load", cardIds, append: hasGame, downloadedOnly: config.downloadedOnly });
  } finally {
    toppingUp = false;
  }
}

function commit(next: PartyGameState): void {
  if (next === state) return;
  const moved = next.index !== state.index || next.queue !== state.queue;
  const timerChanged = next.timer !== state.timer;
  state = next;
  if (moved) prefetchAround(state);
  if (timerChanged) scheduleTimer();
  for (const listener of listeners) listener(state);
  topUpEndless();
}

function localFileUsable(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile() && isPathWithinLibrary(path);
  } catch {
    return false;
  }
}

function loadAnimeDetails(animeIds: number[]): Map<number, PartyAnimeDetails> {
  if (!animeIds.length) return new Map();
  const rows = db
    .select({
      id: anime.id,
      year: anime.year,
      season: anime.season,
      format: anime.format,
      averageScore: anime.averageScore,
      genres: anime.genres,
      tags: anime.tags,
    })
    .from(anime)
    .where(inArray(anime.id, [...new Set(animeIds)]))
    .all();
  return new Map(rows.map(({ id, ...details }) => [id, details]));
}

function resolveQueue(cardIds: number[], downloadedOnly: boolean): { items: PartyQueueItem[]; skipped: number } {
  const settings = { clipSource: getClipSource(), playbackMode: getPlaybackMode(), downloadedOnly };
  const cards = getCardsByIds(cardIds);
  const byId = new Map(cards.map((card) => [card.id, card]));
  const details = loadAnimeDetails(cards.map((card) => card.animeId));
  const items: PartyQueueItem[] = [];
  for (const id of cardIds) {
    const card = byId.get(id);
    const clip = card ? pickPartyClip(card, settings, localFileUsable) : null;
    if (card && clip) {
      items.push(toQueueItem(card, clip, randomBytes(12).toString("hex"), details.get(card.animeId) ?? EMPTY_DETAILS));
    }
  }
  return { items, skipped: cardIds.length - items.length };
}

// Decoy titles come from every show in the library, so a catalog song still
// gets real options even though it has no card.
function choicesFor(item: PartyQueueItem): string[] {
  const rows = db
    .select({
      title: anime.titleEnglish,
      year: anime.year,
      season: anime.season,
      format: anime.format,
      averageScore: anime.averageScore,
      genres: anime.genres,
      tags: anime.tags,
    })
    .from(anime)
    .all();
  const candidates: ChoiceCandidate[] = rows.map(({ title, ...details }) => ({ title, details }));
  return pickChoices(item.answer.animeTitleEnglish, item.details, candidates, item.token);
}

export function runPartyCommand(command: PartyCommand): { loaded?: number; skipped?: number; changed?: boolean } {
  if (command.type === "choices" && command.enabled) {
    const item = currentPartyItem(state);
    commit(applyPartyCommand(state, command, { choices: item ? choicesFor(item) : undefined }));
    return {};
  }
  if (command.type === "queueReroll") return rerollQueueItem(command.index);
  if (command.type === "changeSource") return { changed: changeCurrentSource() };
  if (command.type !== "load") {
    commit(applyPartyCommand(state, command));
    return {};
  }
  // Appending skips songs already queued, so the counts reported back describe
  // what was actually added.
  const queued = command.append ? new Set(state.queue.map((item) => item.cardId)) : null;
  const cardIds = queued
    ? command.cardIds.filter((id) => !queued.has(id)).slice(0, Math.max(0, PARTY_LOAD_MAX - state.queue.length))
    : command.cardIds;
  if (!cardIds.length) return { loaded: 0, skipped: 0 };
  const { items, skipped } = resolveQueue(cardIds, command.downloadedOnly === true);
  commit(applyPartyCommand(state, command, { loaded: items }));
  return { loaded: items.length, skipped };
}

// Moves the song on screen to its next playable clip (local file, stream, video,
// audio), for a clip that is slow or will not play. A song straight from the
// catalog has only the one clip it was added with.
function changeCurrentSource(): boolean {
  const item = currentPartyItem(state);
  if (!item || item.cardId <= 0) return false;
  const card = getCardsByIds([item.cardId])[0];
  if (!card) return false;
  const clips = listPartyClips(card, { clipSource: getClipSource(), playbackMode: getPlaybackMode() }, localFileUsable);
  const clip = nextPartyClip(clips, item.clip);
  if (!clip) return false;
  commit(applyPartyCommand(state, { type: "changeSource" }, { loaded: [{ ...item, clip, token: randomBytes(12).toString("hex") }] }));
  return true;
}

// Swaps an upcoming song for another pick, following the endless settings when
// they are on and otherwise drawing from the whole library.
function rerollQueueItem(index: number): { loaded: number } {
  if (!(index > state.index && index < state.queue.length)) return { loaded: 0 };
  const config = state.endless;
  if (config?.outsideLibrary) {
    void rerollCatalogItem(index);
    return { loaded: 0 };
  }
  const downloadedOnly = config?.downloadedOnly ?? false;
  const cardIds = pickEndlessBatch({
    candidates: listEndlessCandidates(),
    difficulty: config?.difficulty ?? "random",
    downloadedOnly,
    queue: state.queue.map((item) => item.cardId),
    count: 6,
  });
  const { items } = resolveQueue(cardIds, downloadedOnly);
  if (!items.length) return { loaded: 0 };
  commit(applyPartyCommand(state, { type: "queueReroll", index }, { loaded: items.slice(0, 1) }));
  return { loaded: 1 };
}

async function rerollCatalogItem(index: number): Promise<void> {
  try {
    const queued = new Set(state.queue.map((item) => item.cardId));
    const replacement = (await fetchRandomSongs(10)).map(fromRandom).find((item) => item && !queued.has(item.cardId));
    if (replacement) commit(applyPartyCommand(state, { type: "queueReroll", index }, { loaded: [replacement] }));
  } catch {
    // The song stays when AnisongDB cannot answer.
  }
}

// Phones joining through the player door (feature 90a).
export const partyPlayers = createPlayerRegistry({
  getPlayers: () => state.scoreboard.players,
  apply: (command) => commit(applyPartyCommand(state, command)),
});

export function partyJoinInfo(): PartyJoinInfo {
  const urls = (process.env.GAQ_PARTY_PLAYER_URLS ?? "").split(",").filter(Boolean);
  return { urls };
}

/** A phone's buzz; true when it made that player the one answering. */
export function buzzParty(playerId: number): boolean {
  commit(applyPartyCommand(state, { type: "buzz", playerId }));
  return state.buzz.playerId === playerId;
}

/** A phone's multiple-choice pick; true when it was recorded as that player's answer. */
export function pickPartyChoice(playerId: number, index: number): boolean {
  commit(applyPartyCommand(state, { type: "choicePick", playerId, index }));
  return state.choicePicks[playerId] === index;
}

export function findPartyItemByToken(token: string): PartyQueueItem | null {
  return state.queue.find((item) => item.token === token) ?? null;
}

// Only the current item's reports count; a late one from the previous clip
// is dropped. No version bump: the display view is unchanged, so its stream
// stays quiet while the host's stream carries the new position.
export function reportPartyPosition(position: PartyPosition): boolean {
  if (currentPartyItem(state)?.token !== position.token) return false;
  commit({ ...state, position });
  if (shouldRevealEarly(state)) commit(applyPartyCommand(state, { type: "reveal" }));
  driveLightning();
  driveAutoAdvance(position);
  return true;
}

// A lightning round advances itself from the display's play time, which only
// arrives with these reports, so this is where it steps.
function driveLightning(): void {
  const step = lightningStep(state);
  if (step === "reveal") commit(applyPartyCommand(state, { type: "reveal" }));
  else if (step === "next") commit(applyPartyCommand(applyPartyCommand(state, { type: "next" }), { type: "play" }));
  else if (step === "stop") commit(applyPartyCommand(applyPartyCommand(state, { type: "pause" }), { type: "summary", visible: true }));
}

// How long the answer stays up when a song ends unrevealed, and the pause
// before moving on from one that was already revealed.
const END_REVEAL_HOLD_MS = 6000;
const END_REVEALED_HOLD_MS = 1500;
let endedToken: string | null = null;

// A song that plays to its end moves the game on by itself: reveal it first if
// the host has not, then go to the next song and keep playing. Lightning rounds
// run their own clock, and a player answering a buzz is the host's to judge.
function driveAutoAdvance(position: PartyPosition): void {
  if (!position.ended && endedToken === position.token) endedToken = null;
  if (!position.ended || !state.autoAdvance || state.lightning || state.buzz.playerId !== null) return;
  if (endedToken === position.token) return;
  endedToken = position.token;
  const wasRevealed = state.phase === "revealed";
  if (!wasRevealed) commit(applyPartyCommand(state, { type: "reveal" }));
  setTimeout(
    () => {
      if (currentPartyItem(state)?.token !== position.token || !state.autoAdvance) return;
      commit(applyPartyCommand(applyPartyCommand(state, { type: "next" }), { type: "play" }));
    },
    wasRevealed ? END_REVEALED_HOLD_MS : END_REVEAL_HOLD_MS,
  );
}
