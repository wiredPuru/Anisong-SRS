export const LISTEN_MIX_STORAGE_KEY = "gaqSrs:listenMix";
export const LISTEN_MIX_SECONDS = 5;
export const MIN_LISTEN_MIX_SECONDS = 1;

export interface ListenMixSegment {
  duration: number | null;
  startOffset: number;
  playLength: number;
}

export interface ListenMixInputs {
  enabled: boolean;
  autoplay: boolean;
  outgoing: ListenMixSegment | null;
  incoming: ListenMixSegment | null;
}

export interface ListenPlaybackTiming {
  duration: number | null;
  currentTime: number;
  playLengthRemaining: number | null;
}

export function parseListenMixPreference(stored: string | null): boolean {
  return stored === "1";
}

function segmentSeconds(segment: ListenMixSegment | null): number {
  if (!segment || segment.duration === null) return 0;
  const { duration, startOffset, playLength } = segment;
  if (![duration, startOffset, playLength].every(Number.isFinite)
    || duration <= 0 || startOffset < 0 || startOffset >= duration || playLength < 0) return 0;
  return Math.min(duration - startOffset, playLength > 0 ? playLength : Infinity);
}

/** Zero means the boundary should use ordinary advancement. */
export function planListenMix({ enabled, autoplay, outgoing, incoming }: ListenMixInputs): number {
  if (!enabled || !autoplay) return 0;
  const seconds = Math.min(LISTEN_MIX_SECONDS, segmentSeconds(outgoing) / 2, segmentSeconds(incoming) / 2);
  return seconds >= MIN_LISTEN_MIX_SECONDS ? seconds : 0;
}

/** A seek changes the clip endpoint, but the caller's playing-time budget is kept. */
export function remainingListenSeconds({ duration, currentTime, playLengthRemaining }: ListenPlaybackTiming): number | null {
  if (!Number.isFinite(currentTime) || currentTime < 0) return null;
  const mediaRemaining = duration !== null && Number.isFinite(duration) && duration > 0
    ? Math.max(0, duration - currentTime)
    : null;
  if (playLengthRemaining === null) return mediaRemaining;
  if (!Number.isFinite(playLengthRemaining) || playLengthRemaining < 0) return null;
  return mediaRemaining === null ? playLengthRemaining : Math.min(mediaRemaining, playLengthRemaining);
}

export function listenMixGains(progress: number): { outgoing: number; incoming: number } {
  const incoming = Number.isNaN(progress) ? 0 : Math.min(1, Math.max(0, progress));
  return { outgoing: 1 - incoming, incoming };
}
