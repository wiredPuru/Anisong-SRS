export const MAX_DECK_PICTURE_BYTES = 5 * 1024 * 1024;

export const DECK_PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp"];

// Mirrors the server's limits (server/utils/deckImage.ts) for instant feedback;
// the server still sniffs the real format and stays the authority.
export function validateDeckPicture(file: { type: string; size: number }): string | null {
  if (!DECK_PICTURE_TYPES.includes(file.type)) return "Pick a PNG, JPEG or WebP picture.";
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_DECK_PICTURE_BYTES) return "That picture is over the 5 MB limit.";
  return null;
}
