import { isRemoteUrlAllowed, type ClipSource } from "./clipSource";

export interface RemoteSourceCard {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}

// The remote URL playback would actually request for this card, or null if
// it would play from a local file (or has nothing playable at all - no
// source, or every remote source is on a host the Clip source setting
// excludes). Video takes priority whenever an allowed video source exists,
// mirroring StudyMediaPlayer's own mediaKind logic - keep the two in sync.
// When audioOnly is true and the card has an allowed audio source (local or
// remote), audio takes priority instead - a video-only card still falls back
// to video, same as mediaKind does.
export function resolveRemotePrefetchUrl(
  card: RemoteSourceCard,
  audioOnly = false,
  clipSource: ClipSource = "anisongdb",
): string | null {
  const hasAudioSource = Boolean(card.localAudioPath) || isRemoteUrlAllowed(card.animethemesAudioUrl, clipSource);
  if (audioOnly && hasAudioSource) {
    return card.localAudioPath ? null : card.animethemesAudioUrl;
  }

  const hasVideoSource = Boolean(card.localVideoPath) || isRemoteUrlAllowed(card.animethemesVideoUrl, clipSource);
  if (hasVideoSource) {
    return card.localVideoPath ? null : card.animethemesVideoUrl;
  }
  return hasAudioSource ? (card.localAudioPath ? null : card.animethemesAudioUrl) : null;
}
