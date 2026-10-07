import { isRemoteUrlAllowed, type ClipSource } from "./clipSource";

export interface PlayableSourceCard {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}

/** A local file always counts; a remote URL counts only on a host the Clip source setting allows. */
export function isPlayableCard(card: PlayableSourceCard, clipSource: ClipSource): boolean {
  return Boolean(card.localVideoPath)
    || Boolean(card.localAudioPath)
    || isRemoteUrlAllowed(card.animethemesVideoUrl, clipSource)
    || isRemoteUrlAllowed(card.animethemesAudioUrl, clipSource);
}

/** Moving past the last song ends the playlist; moving back from the first stays on it. */
export function stepIndex(index: number, total: number, direction: "next" | "previous"): number | "finished" {
  if (total <= 0) return 0;
  if (direction === "previous") return Math.max(0, index - 1);
  return index + 1 >= total ? "finished" : index + 1;
}

export function positionLabel(index: number, total: number): string {
  return `${Math.min(index + 1, total)} / ${total}`;
}
