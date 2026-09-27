import { randomBytes } from "node:crypto";
import { getCardsByIds } from "./cards.ts";
import { getClipSource, getPlaybackMode } from "./mediaLibrary.ts";
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

function commit(next: PartyGameState): void {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener(state);
}

function resolveQueue(cardIds: number[]): { items: PartyQueueItem[]; skipped: number } {
  const settings = { clipSource: getClipSource(), playbackMode: getPlaybackMode() };
  const byId = new Map(getCardsByIds(cardIds).map((card) => [card.id, card]));
  const items: PartyQueueItem[] = [];
  for (const id of cardIds) {
    const card = byId.get(id);
    const clip = card ? pickPartyClip(card, settings) : null;
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
