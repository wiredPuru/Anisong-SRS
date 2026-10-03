export type DeckImageType = "png" | "jpeg" | "webp";

export const MAX_DECK_IMAGE_BYTES = 5 * 1024 * 1024;

export const DECK_IMAGE_MIME: Record<DeckImageType, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

const EXTENSION: Record<DeckImageType, string> = { png: "png", jpeg: "jpg", webp: "webp" };

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, magic: readonly number[], offset = 0): boolean {
  return bytes.length >= offset + magic.length && magic.every((b, i) => bytes[offset + i] === b);
}

// The client's Content-Type and file name are never trusted: the format comes
// from the leading bytes alone.
export function sniffImageType(bytes: Uint8Array): DeckImageType | null {
  if (startsWith(bytes, PNG_MAGIC)) return "png";
  if (startsWith(bytes, JPEG_MAGIC)) return "jpeg";
  const isWebp = startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8);
  return isWebp ? "webp" : null;
}

export function deckImageFileName(deckId: number, type: DeckImageType, token: string): string {
  return `${deckId}-${token}.${EXTENSION[type]}`;
}

const SAFE_NAME = /^\d+-[0-9a-f]{8}\.(png|jpg|webp)$/;

// Stored names are built by deckImageFileName, so anything else (a separator,
// a dot-dot, an odd extension) is refused before it can reach the filesystem.
export function isSafeDeckImageName(name: string): boolean {
  return SAFE_NAME.test(name);
}

export function mimeForDeckImageName(name: string): string | null {
  if (!isSafeDeckImageName(name)) return null;
  if (name.endsWith(".png")) return DECK_IMAGE_MIME.png;
  if (name.endsWith(".jpg")) return DECK_IMAGE_MIME.jpeg;
  return DECK_IMAGE_MIME.webp;
}
