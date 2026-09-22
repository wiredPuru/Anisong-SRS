// In-flight guard for POST /api/cards/download: without it, two concurrent
// requests for the same card+kind both pass the "no local path yet" check
// and each write a file, with whichever `updateCard` lands last winning the
// card's stored path and orphaning the other's file. Module-level state is
// fine here - this app runs as a single localhost process, the same scoping
// streamCache.ts already uses for its own in-flight-fetch dedupe.
const inFlight = new Set<string>();

export function downloadGuardKey(cardId: number, kind: "video" | "audio"): string {
  return `${cardId}:${kind}`;
}

// Synchronous check-and-set: no `await` may separate the two calls inside
// this function, or two requests could both observe the key as free.
export function acquireDownloadGuard(key: string): boolean {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
}

export function releaseDownloadGuard(key: string): void {
  inFlight.delete(key);
}
