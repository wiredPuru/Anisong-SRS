import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { getCardsByIds } from "./cards.ts";
import { getClipSource, getPlaybackMode, isPathWithinLibrary } from "./mediaLibrary.ts";
import { resolveCachedPath } from "./streamCache.ts";
import { EMPTY_DETAILS, type PartyAnimeDetails } from "./partyLightning.ts";
import { createPlayerRegistry } from "./partyPlayers.ts";
import {
  applyPartyCommand,
  currentPartyItem,
  initialPartyState,
  lightningStep,
  PARTY_LOOKAHEAD,
  pickPartyClip,
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

function commit(next: PartyGameState): void {
  if (next === state) return;
  const moved = next.index !== state.index || next.queue !== state.queue;
  const timerChanged = next.timer !== state.timer;
  state = next;
  if (moved) prefetchAround(state);
  if (timerChanged) scheduleTimer();
  for (const listener of listeners) listener(state);
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

export function runPartyCommand(command: PartyCommand): { loaded?: number; skipped?: number } {
  if (command.type !== "load") {
    commit(applyPartyCommand(state, command));
    return {};
  }
  const { items, skipped } = resolveQueue(command.cardIds, command.downloadedOnly === true);
  commit(applyPartyCommand(state, command, { loaded: items }));
  return { loaded: items.length, skipped };
}

// Phones joining through the player door (feature 90a).
export const partyPlayers = createPlayerRegistry({
  getPlayers: () => state.scoreboard.players,
  apply: (command) => commit(applyPartyCommand(state, command)),
});

export function partyJoinInfo(): PartyJoinInfo {
  const urls = (process.env.GAQ_PARTY_PLAYER_URLS ?? "").split(",").filter(Boolean);
  return { code: partyPlayers.roomCode(), urls };
}

// The room code lives outside the game state, so a new one bumps the version
// to push the displays a fresh view.
export function regeneratePartyRoomCode(): string {
  const code = partyPlayers.regenerateRoomCode();
  commit({ ...state, version: state.version + 1 });
  return code;
}

/** A phone's buzz; true when it made that player the one answering. */
export function buzzParty(playerId: number): boolean {
  commit(applyPartyCommand(state, { type: "buzz", playerId }));
  return state.buzz.playerId === playerId;
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
  driveLightning();
  return true;
}

// A lightning round advances itself from the display's play time, which only
// arrives with these reports, so this is where it steps.
function driveLightning(): void {
  const step = lightningStep(state);
  if (step === "reveal") commit(applyPartyCommand(state, { type: "reveal" }));
  else if (step === "next") commit(applyPartyCommand(applyPartyCommand(state, { type: "next" }), { type: "play" }));
  else if (step === "stop") commit(applyPartyCommand(state, { type: "pause" }));
}
