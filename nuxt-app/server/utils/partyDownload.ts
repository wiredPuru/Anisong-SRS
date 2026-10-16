import { mkdirSync } from "node:fs";
import { buildDownloadBaseName, downloadMediaFile } from "./mediaDownload.ts";
import { pickPartyClip, type PartyClip, type PartyGameState, type PartyQueueItem } from "./partyGame.ts";

export const PARTY_DOWNLOAD_AHEAD = 3;

/** Upcoming catalog songs (no card behind them) still streaming from a remote URL. */
export function selectDownloadTargets(
  state: Pick<PartyGameState, "queue" | "index">,
  attempted: ReadonlySet<string>,
  ahead: number = PARTY_DOWNLOAD_AHEAD,
): PartyQueueItem[] {
  const from = Math.max(state.index, -1) + 1;
  return state.queue
    .slice(from, from + ahead)
    .filter((item) => item.cardId < 0 && item.clip.source.type === "remote" && !attempted.has(item.token));
}

type ClipCard = Parameters<typeof pickPartyClip>[0];
type ClipSettings = Parameters<typeof pickPartyClip>[1];

/** A library song counts as downloaded once it has any local file. */
export function hasLocalFile(card: Pick<ClipCard, "localVideoPath" | "localAudioPath">): boolean {
  return Boolean(card.localVideoPath || card.localAudioPath);
}

/** The kind to save so the party plays from disk: the stream it would play now, or null if nothing needs saving. */
export function partyDownloadKind(card: ClipCard, settings: ClipSettings): "video" | "audio" | null {
  if (hasLocalFile(card)) return null;
  const clip = pickPartyClip(card, { ...settings, downloadedOnly: false });
  return clip?.source.type === "remote" ? clip.kind : null;
}

/** Swaps a downloaded clip in, but only for a song that has not started yet. */
export function withLocalClip(state: PartyGameState, token: string, clip: PartyClip): PartyGameState {
  const at = state.queue.findIndex((item) => item.token === token);
  if (at <= state.index) return state;
  const queue = state.queue.map((item, i) => (i === at ? { ...item, clip } : item));
  return { ...state, queue };
}

/** Saves one catalog song's clip into the folder; the local clip, or null on any failure. */
export async function downloadCatalogClip(item: PartyQueueItem, folder: string): Promise<PartyClip | null> {
  const source = item.clip.source;
  if (source.type !== "remote") return null;
  try {
    mkdirSync(folder, { recursive: true });
    const { baseName, ext } = buildDownloadBaseName({
      animeTitleRomaji: item.answer.animeTitleRomaji,
      themeSlot: item.answer.themeSlot,
      artistName: item.answer.artistName,
      url: source.url,
      kind: item.clip.kind,
    });
    for await (const event of downloadMediaFile(source.url, folder, baseName, ext)) {
      if (event.type === "success") return { kind: item.clip.kind, source: { type: "local", path: event.path } };
      if (event.type === "error") return null;
    }
  } catch {
    // A failed download just leaves the song streaming.
  }
  return null;
}
