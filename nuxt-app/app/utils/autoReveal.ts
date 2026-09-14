/** Whole seconds left before an Auto Reveal fires, rounded up so the pill shows 1 until the reveal itself. */
export function remainingRevealSeconds(durationMs: number, elapsedMs = 0): number {
  return Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
}
