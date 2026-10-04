export const SKIP_TAIL_SECONDS = 3;

/** Where "Skip to end" seeks: the last few seconds, to 0.1s, or null while the duration is unknown. */
export function skipTarget(duration: number | null | undefined): number | null {
  if (duration == null || !Number.isFinite(duration) || duration <= 0) return null;
  return Math.max(0, Math.round((duration - SKIP_TAIL_SECONDS) * 10) / 10);
}
