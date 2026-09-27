import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { getCardsByIds } from "./cards.ts";
import { getClipSource, getPlaybackMode, isPathWithinLibrary } from "./mediaLibrary.ts";
import { resolveCachedPath } from "./streamCache.ts";
import {
  applyPartyCommand,
  currentPartyItem,
  initialPartyState,
  pickPartyClip,
  toQueueItem,
  type PartyCommand,
  type PartyGameState,
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

const PREFETCH_AHEAD = 2;

// A remote clip plays only once the stream cache holds all of it, so the
// current song and the next two are fetched as soon as the game moves, the way
// Study prefetches its lookahead. Failures are the clip route's to report.
function prefetchAround(current: PartyGameState): void {
  for (const item of current.queue.slice(Math.max(current.index, 0), current.index + 1 + PREFETCH_AHEAD)) {
    if (item.clip.source.type === "remote") void resolveCachedPath(item.clip.source.url).catch(() => {});
  }
}

function commit(next: PartyGameState): void {
  if (next === state) return;
  const moved = next.index !== state.index || next.queue !== state.queue;
  state = next;
  if (moved) prefetchAround(state);
  for (const listener of listeners) listener(state);
}

function localFileUsable(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile() && isPathWithinLibrary(path);
  } catch {
    return false;
  }
}

function resolveQueue(cardIds: number[]): { items: PartyQueueItem[]; skipped: number } {
  const settings = { clipSource: getClipSource(), playbackMode: getPlaybackMode() };
  const byId = new Map(getCardsByIds(cardIds).map((card) => [card.id, card]));
  const items: PartyQueueItem[] = [];
  for (const id of cardIds) {
    const card = byId.get(id);
    const clip = card ? pickPartyClip(card, settings, localFileUsable) : null;
    if (card && clip) items.push(toQueueItem(card, clip, randomBytes(12).toString("hex")));
  }
  return { items, skipped: cardIds.length - items.length };
}

export function runPartyCommand(command: PartyCommand): { loaded?: number; skipped?: number } {
  if (command.type !== "load") {
    commit(applyPartyCommand(state, command));
    return {};
  }
  const { items, skipped } = resolveQueue(command.cardIds);
  commit(applyPartyCommand(state, command, { loaded: items }));
  return { loaded: items.length, skipped };
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
  return true;
}
