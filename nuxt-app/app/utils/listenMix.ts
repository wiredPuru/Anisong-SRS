export const LISTEN_MIX_STORAGE_KEY = "gaqSrs:listenMix";
export const LISTEN_MIX_CURVE_STORAGE_KEY = "gaqSrs:listenMixCurve";
export const LISTEN_MIX_LENGTH_STORAGE_KEY = "gaqSrs:listenMixSeconds";
export const LISTEN_MIX_LENGTH_OPTIONS = [2, 5, 8, 12] as const;
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
  /** The chosen fade length; the plan can only be shorter. */
  targetSeconds?: number;
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

/** Only an exact saved "linear" opts out of the smooth default. */
export function parseListenMixCurve(stored: string | null): "smooth" | "linear" {
  return stored === "linear" ? "linear" : "smooth";
}

/** Anything but an exact option reads as the default. */
export function parseListenMixLength(stored: string | null): number {
  const option = LISTEN_MIX_LENGTH_OPTIONS.find((length) => String(length) === stored);
  return option ?? LISTEN_MIX_SECONDS;
}

/** Seconds a "Next in" label shows when the next song starts at the handoff. */
export function secondsUntilHandoff(remaining: number, mixSeconds: number): number {
  return Math.max(0, remaining - mixSeconds);
}

function segmentSeconds(segment: ListenMixSegment | null): number {
  if (!segment || segment.duration === null) return 0;
  const { duration, startOffset, playLength } = segment;
  if (![duration, startOffset, playLength].every(Number.isFinite)
    || duration <= 0 || startOffset < 0 || startOffset >= duration || playLength < 0) return 0;
  return Math.min(duration - startOffset, playLength > 0 ? playLength : Infinity);
}

/** Zero means the boundary should use ordinary advancement. */
export function planListenMix({ enabled, autoplay, targetSeconds = LISTEN_MIX_SECONDS, outgoing, incoming }: ListenMixInputs): number {
  if (!enabled || !autoplay) return 0;
  const seconds = Math.min(targetSeconds, segmentSeconds(outgoing) / 2, segmentSeconds(incoming) / 2);
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
