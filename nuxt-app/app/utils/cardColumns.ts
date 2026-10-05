export const DEFAULT_SONG_SHARE = 0.55;
export const MIN_TEXT_COLUMN_PX = 120;

/** Keeps both text columns at least the minimum width; the default when the area cannot fit two. */
export function clampSongShare(share: number, areaWidth: number): number {
  if (!Number.isFinite(share) || !Number.isFinite(areaWidth)) return DEFAULT_SONG_SHARE;
  if (areaWidth < MIN_TEXT_COLUMN_PX * 2) return DEFAULT_SONG_SHARE;
  const min = MIN_TEXT_COLUMN_PX / areaWidth;
  return Math.min(1 - min, Math.max(min, share));
}

/** The Song share implied by a pointer position over the Song and Anime area. */
export function songShareFromPointer(pointerX: number, areaLeft: number, areaWidth: number): number {
  if (!(areaWidth > 0)) return DEFAULT_SONG_SHARE;
  return clampSongShare((pointerX - areaLeft) / areaWidth, areaWidth);
}

/** A stored share is only a hint: anything that is not a fraction between 0 and 1 means the default. */
export function parseStoredSongShare(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_SONG_SHARE;
  const value = Number(raw);
  return value > 0 && value < 1 ? value : DEFAULT_SONG_SHARE;
}
