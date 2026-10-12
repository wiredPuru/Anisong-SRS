import type { Rgb } from "./ambientTint";
import { isSavedImage } from "./networkImage";

export const LAST_PLAYED_STORAGE_KEY = "gaqSrs:lastPlayed";

/** The clip the rest of the app paints its ambient backdrop from. */
export interface LastPlayed {
  cardId: number;
  songTitle: string;
  animeTitle: string;
  /** A small JPEG data URL of a frame, or the anime's cover URL for an audio-only card. */
  image: string;
  tint: Rgb | null;
}

function isRgb(value: unknown): value is Rgb {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((c) => typeof c === "number" && Number.isInteger(c) && c >= 0 && c <= 255)
  );
}

function isSafeImage(value: unknown): value is string {
  return typeof value === "string" && (isSavedImage(value) || value.startsWith("https://"));
}

export function parseLastPlayed(raw: string | null): LastPlayed | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.cardId !== "number" || !Number.isInteger(v.cardId)) return null;
  if (typeof v.songTitle !== "string" || typeof v.animeTitle !== "string") return null;
  if (!isSafeImage(v.image)) return null;
  const tint = isRgb(v.tint) ? v.tint : null;
  return { cardId: v.cardId, songTitle: v.songTitle, animeTitle: v.animeTitle, image: v.image, tint };
}
