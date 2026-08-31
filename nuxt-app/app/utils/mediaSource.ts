export interface RemoteSourceCard {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}

// The remote URL playback would actually request for this card, or null if
// it would play from a local file (or has no source at all). Video takes
// priority whenever any video source exists, mirroring StudyMediaPlayer's
// own mediaKind logic - keep the two in sync. When audioOnly is true and the
// card has an audio source (local or remote), audio takes priority instead -
// a video-only card still falls back to video, same as mediaKind does.
export function resolveRemotePrefetchUrl(card: RemoteSourceCard, audioOnly = false): string | null {
  const hasAudioSource = Boolean(card.localAudioPath || card.animethemesAudioUrl);
  if (audioOnly && hasAudioSource) {
    return card.localAudioPath ? null : card.animethemesAudioUrl;
  }

  const hasVideoSource = Boolean(card.localVideoPath || card.animethemesVideoUrl);
  if (hasVideoSource) {
    return card.localVideoPath ? null : card.animethemesVideoUrl;
  }
  return card.localAudioPath ? null : card.animethemesAudioUrl;
}
