export type PartyCoverDoor = "host" | "display";

/**
 * A party door only serves party routes, so a cover reaches the host panel or
 * the display by queue token rather than as the SRS's own /api/anime/cover path.
 */
export function partyCoverPath(door: PartyCoverDoor, token: string, coverImageUrl: string | null): string | null {
  return coverImageUrl ? `/api/party/${door}/cover?t=${encodeURIComponent(token)}` : null;
}
