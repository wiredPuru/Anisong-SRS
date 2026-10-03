import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { resolveDbPath } from "../db/dataDir.ts";
import { db } from "../db/client.ts";
import { deck } from "../db/schema.ts";
import {
  deckImageFileName,
  isSafeDeckImageName,
  MAX_DECK_IMAGE_BYTES,
  mimeForDeckImageName,
  sniffImageType,
} from "./deckImage.ts";

/** The picture folder beside the database, resolved per call so the data directory can move. */
export function deckImageFolder(): string {
  return join(dirname(resolveDbPath(process.env, process.cwd())), "deck-images");
}

export function deckImageUrl(deckId: number, fileName: string | null): string | null {
  return fileName && isSafeDeckImageName(fileName) ? `/api/decks/image?id=${deckId}&v=${fileName}` : null;
}

// Best-effort, like feature 17's file cleanup: a missing file or a filesystem
// error must never fail the deck operation that triggered it.
export function deleteDeckImageFile(fileName: string | null): void {
  if (!fileName || !isSafeDeckImageName(fileName)) return;
  try {
    unlinkSync(join(deckImageFolder(), fileName));
  } catch {
    // already gone
  }
}

function currentFileName(deckId: number): { exists: false } | { exists: true; fileName: string | null } {
  const row = db.select({ imagePath: deck.imagePath }).from(deck).where(eq(deck.id, deckId)).get();
  return row ? { exists: true, fileName: row.imagePath } : { exists: false };
}

export type SaveDeckImageResult =
  | { notFound: true }
  | { error: "too-large" | "unsupported" }
  | { imageUrl: string };

// Order matters: write the new file, point the deck at it, and only then delete
// the old one, so a failure never leaves a deck referring to a missing file.
export function saveDeckImage(deckId: number, bytes: Uint8Array): SaveDeckImageResult {
  const current = currentFileName(deckId);
  if (!current.exists) return { notFound: true };
  if (bytes.length > MAX_DECK_IMAGE_BYTES) return { error: "too-large" };
  const type = sniffImageType(bytes);
  if (!type) return { error: "unsupported" };

  const fileName = deckImageFileName(deckId, type, randomBytes(4).toString("hex"));
  const folder = deckImageFolder();
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, fileName), bytes);

  try {
    db.update(deck).set({ imagePath: fileName }).where(eq(deck.id, deckId)).run();
  } catch (error) {
    deleteDeckImageFile(fileName);
    throw error;
  }
  deleteDeckImageFile(current.fileName);
  return { imageUrl: deckImageUrl(deckId, fileName)! };
}

export type RemoveDeckImageResult = { notFound: true } | { success: true };

export function removeDeckImage(deckId: number): RemoveDeckImageResult {
  const current = currentFileName(deckId);
  if (!current.exists) return { notFound: true };
  if (current.fileName === null) return { success: true };
  db.update(deck).set({ imagePath: null }).where(eq(deck.id, deckId)).run();
  deleteDeckImageFile(current.fileName);
  return { success: true };
}

export type DeckImageFile = { path: string; mime: string };

/** The file the deck currently holds, looked up from its own row and never from request input. */
export function getDeckImageFile(deckId: number): DeckImageFile | null {
  const current = currentFileName(deckId);
  if (!current.exists || !current.fileName) return null;
  const mime = mimeForDeckImageName(current.fileName);
  const path = join(deckImageFolder(), current.fileName);
  return mime && existsSync(path) ? { path, mime } : null;
}
