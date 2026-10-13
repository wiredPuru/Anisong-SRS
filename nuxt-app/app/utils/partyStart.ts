// Where a random party start begins: the fraction picks a point between the
// floor and the usual tail margin, so it never lands on an opening title card.
// A fraction of 0 means no random start. A clip too short for the floor
// ignores it rather than starting past where the tail would allow.
export function partyStartTime(fraction: number, duration: number, tail: number, floor: number): number {
  if (!(fraction > 0) || !Number.isFinite(duration)) return 0;
  const start = floor > 0 && duration - tail - floor > 0 ? floor : 0;
  return start + fraction * Math.max(0, duration - tail - start);
}
