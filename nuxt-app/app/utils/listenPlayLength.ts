// Seconds of each song /listen plays before moving on; 0 plays the whole song.
export const PLAY_LENGTH_OPTIONS: readonly number[] = [0, 10, 15, 20, 30, 45, 60, 90, 120];

export function parsePlayLength(stored: string | null): number {
  if (stored === null || stored.trim() === "") return 0;
  const seconds = Number(stored);
  return PLAY_LENGTH_OPTIONS.includes(seconds) ? seconds : 0;
}

export function formatPlayLength(seconds: number): string {
  if (seconds <= 0) return "Full song";
  if (seconds >= 120 && seconds % 60 === 0) return `${seconds / 60} min`;
  return `${seconds}s`;
}
