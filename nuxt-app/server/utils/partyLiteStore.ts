import { randomBytes } from "node:crypto";
import { prepareCardDownload, runCardDownload } from "./cardDownload.ts";
import { getCardWithDetails, getCardsByIds, type CardWithDetails } from "./cards.ts";
import { localMediaAvailable } from "./localMedia.ts";
import { getClipSource, getDefaultDownloadFolder, getOfflineMode, getPlaybackMode } from "./mediaLibrary.ts";
import { partyDownloadKind } from "./partyDownload.ts";
import { pickPartyClip } from "./partyGame.ts";
import {
  advance,
  allLiteSongs,
  fillNeeded,
  goBack,
  heldCardIds,
  initialLiteState,
  insertManual,
  patchSong,
  pickCandidates,
  removeSong,
  replaceSong,
  withoutAutoPicks,
  type LiteCommand,
  type LitePosition,
  type LiteSong,
  type LiteState,
} from "./partyLiteGame.ts";
import { listPartyCardIds } from "./partySources.ts";

const PROGRESS_STEP = 5;

// In memory on purpose, like the first party mode: a restart ends the game.
let state = initialLiteState();
const listeners = new Set<(state: LiteState) => void>();
let downloading = false;
let endedToken: string | null = null;

export function getLiteState(): LiteState {
  return state;
}

export function onLiteChange(listener: (state: LiteState) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function commit(next: LiteState): void {
  if (next === state) return;
  state = { ...next, version: state.version + 1 };
  for (const listener of listeners) listener(state);
}

function clipSettings() {
  return { clipSource: getClipSource(), playbackMode: getPlaybackMode(), offlineMode: getOfflineMode() };
}

function canDownload(): boolean {
  return !getOfflineMode() && Boolean(getDefaultDownloadFolder());
}

function toSong(card: CardWithDetails, manual: boolean): LiteSong | null {
  const clip = pickPartyClip(card, clipSettings(), localMediaAvailable);
  if (!clip) return null;
  return {
    token: randomBytes(12).toString("hex"),
    cardId: card.id,
    manual,
    clip,
    answer: {
      animeTitle: card.animeTitleEnglish,
      animeTitleRomaji: card.animeTitleRomaji,
      songTitle: card.songTitle,
      artistName: card.artistName,
      themeSlot: card.themeSlot,
      coverImageUrl: card.animeCoverImageUrl,
    },
    download: clip.source.type === "local" ? "local" : canDownload() ? "waiting" : "stream",
    progress: null,
  };
}

function matchingIds(source: LiteState["source"]): number[] {
  return listPartyCardIds(source.scope, source.filters);
}

/** Random filter picks that can actually play, skipping the cards in `avoid` too. */
function pickSongs(from: LiteState, count: number, avoid: readonly number[] = []): LiteSong[] {
  if (count <= 0) return [];
  const held = heldCardIds(from);
  for (const id of avoid) held.add(id);
  const recent = from.history.map((song) => song.cardId);
  // A few spares, since a card whose clip the settings rule out is passed over.
  const ids = pickCandidates(matchingIds(from.source), held, recent, count * 3);
  const cards = new Map(getCardsByIds(ids).map((card) => [card.id, card]));
  const songs: LiteSong[] = [];
  for (const id of ids) {
    const card = cards.get(id);
    const song = card ? toSong(card, false) : null;
    if (song) songs.push(song);
    if (songs.length === count) break;
  }
  return songs;
}

function refill(next: LiteState): LiteState {
  const songs = pickSongs(next, fillNeeded(next));
  return songs.length ? { ...next, upNext: [...next.upNext, ...songs] } : next;
}

function settle(next: LiteState): void {
  commit(refill(next));
  void downloadWaiting();
}

export function runLiteCommand(command: LiteCommand): { error?: string } {
  switch (command.type) {
    case "play":
      settle(state.current ? { ...state, playing: true } : advance(refill(state)));
      return {};
    case "pause":
      commit({ ...state, playing: false });
      return {};
    case "reveal":
      commit({ ...state, revealed: true });
      return {};
    case "seek":
      commit({ ...state, seekTo: command.seconds, seekSeq: state.seekSeq + 1 });
      return {};
    case "next":
      settle(advance(state));
      return {};
    case "previous":
      settle(goBack(state));
      return {};
    case "remove":
      settle(removeSong(state, command.token));
      return {};
    case "reroll": {
      const old = state.upNext.find((song) => song.token === command.token);
      if (!old) return {};
      const [fresh] = pickSongs(state, 1, [old.cardId]);
      if (!fresh) return { error: "No other song matches the filters." };
      commit(replaceSong(state, command.token, fresh));
      void downloadWaiting();
      return {};
    }
    case "rerollAll": {
      const dropped = state.upNext.filter((song) => !song.manual).map((song) => song.cardId);
      const kept = withoutAutoPicks(state);
      const fresh = pickSongs(kept, fillNeeded(kept), dropped);
      // A pool too small to avoid the old picks gets them back, reshuffled.
      const picks = fresh.length ? fresh : pickSongs(kept, fillNeeded(kept));
      commit({ ...kept, upNext: [...kept.upNext, ...picks] });
      void downloadWaiting();
      return {};
    }
    case "add": {
      const card = getCardWithDetails(command.cardId);
      const song = card ? toSong(card, true) : null;
      if (!song) return { error: card ? "That song has no clip the settings allow." : "That song is no longer in the library." };
      commit(insertManual(state, song, command.position));
      void downloadWaiting();
      return {};
    }
    case "endless":
      settle({ ...state, source: { ...state.source, endless: command.enabled } });
      return {};
    case "source": {
      const source = { ...state.source, scope: command.scope, label: command.label, filters: command.filters };
      settle(withoutAutoPicks({ ...state, source, matchCount: matchingIds(source).length }));
      return {};
    }
  }
}

/** The match count is read when a host connects, so it follows library changes made since. */
export function refreshLiteMatchCount(): void {
  const matchCount = matchingIds(state.source).length;
  if (matchCount !== state.matchCount) settle({ ...state, matchCount });
}

export function findLiteSong(token: string): LiteSong | null {
  return allLiteSongs(state).find((song) => song.token === token) ?? null;
}

/** The display's playback report. Host-only: it never changes what the display is sent. */
export function reportLitePosition(report: LitePosition & { ended: boolean }): boolean {
  if (state.current?.token !== report.token) return false;
  const { ended, ...position } = report;
  commit({ ...state, position });
  if (!ended && endedToken === report.token) endedToken = null;
  if (ended && endedToken !== report.token) {
    endedToken = report.token;
    settle(advance(state));
  }
  return true;
}

/** Saves waiting songs into the library one at a time, so they play from disk. */
async function downloadWaiting(): Promise<void> {
  if (downloading) return;
  downloading = true;
  try {
    for (;;) {
      const song = [...(state.current ? [state.current] : []), ...state.upNext].find((item) => item.download === "waiting");
      if (!song) return;
      const clip = await downloadSong(song);
      commit(patchSong(state, song.token, clip ? { clip, download: "local", progress: null } : { download: "stream", progress: null }));
    }
  } finally {
    downloading = false;
  }
}

async function downloadSong(song: LiteSong): Promise<LiteSong["clip"] | null> {
  try {
    if (!canDownload()) return null;
    const card = getCardWithDetails(song.cardId);
    const kind = card ? partyDownloadKind(card, clipSettings()) : null;
    if (!card || !kind) return card ? pickLocal(card) : null;
    commit(patchSong(state, song.token, { download: "downloading", progress: 0 }));
    let shown = 0;
    for await (const step of runCardDownload(prepareCardDownload(song.cardId, kind))) {
      if (step.type === "progress" && step.total > 0) {
        const percent = Math.floor((step.loaded / step.total) * 100);
        if (percent >= shown + PROGRESS_STEP) {
          shown = percent;
          commit(patchSong(state, song.token, { progress: percent }));
        }
      }
      if (step.type === "done") return pickLocal(step.card);
      if (step.type === "error") return null;
    }
  } catch {
    // A failed download just leaves the song streaming.
  }
  return null;
}

function pickLocal(card: CardWithDetails): LiteSong["clip"] | null {
  const clip = pickPartyClip(card, clipSettings(), localMediaAvailable);
  return clip?.source.type === "local" ? clip : null;
}
