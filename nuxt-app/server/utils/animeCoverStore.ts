import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { eq } from "drizzle-orm";
import { resolveDbPath } from "../db/dataDir.ts";
import { db } from "../db/client.ts";
import { anime } from "../db/schema.ts";
import { deckImageFileName, isSafeDeckImageName, MAX_DECK_IMAGE_BYTES, mimeForDeckImageName, sniffImageType } from "./deckImage.ts";

// Covers share deck pictures' size cap, magic-byte sniffing, and
// `<id>-<8 hex>.<ext>` names, since both are small user-data images.
export const MAX_ANIME_COVER_BYTES = MAX_DECK_IMAGE_BYTES;

export function animeCoverFolder(): string {
  return join(dirname(resolveDbPath(process.env, process.cwd())), "anime-covers");
}

// Best-effort, like deck pictures: a missing file must never fail the caller.
function deleteCoverFile(fileName: string | null): void {
  if (!fileName || !isSafeDeckImageName(fileName)) return;
  try {
    unlinkSync(join(animeCoverFolder(), fileName));
  } catch {
    // already gone
  }
}

export type SaveAnimeCoverResult = { notFound: true } | { error: "too-large" | "unsupported" } | { fileName: string };

// Write the new file, point the row at it, and only then delete the old one, so
// a failure never leaves an anime naming a file that is not there.
export function saveAnimeCover(animeId: number, bytes: Uint8Array): SaveAnimeCoverResult {
  const row = db.select({ coverImagePath: anime.coverImagePath }).from(anime).where(eq(anime.id, animeId)).get();
  if (!row) return { notFound: true };
  if (bytes.length > MAX_ANIME_COVER_BYTES) return { error: "too-large" };
  const type = sniffImageType(bytes);
  if (!type) return { error: "unsupported" };

  const fileName = deckImageFileName(animeId, type, randomBytes(4).toString("hex"));
  const folder = animeCoverFolder();
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, fileName), bytes);

  try {
    db.update(anime).set({ coverImagePath: fileName }).where(eq(anime.id, animeId)).run();
  } catch (error) {
    deleteCoverFile(fileName);
    throw error;
  }
  deleteCoverFile(row.coverImagePath);
  return { fileName };
}

export type AnimeCover = { kind: "file"; path: string; mime: string } | { kind: "remote"; url: string };

/** The anime's cover from its own row, never from request input: the saved file when it still exists, else the AniList URL. */
export function resolveAnimeCover(animeId: number): AnimeCover | null {
  const row = db
    .select({ coverImagePath: anime.coverImagePath, coverImageUrl: anime.coverImageUrl })
    .from(anime)
    .where(eq(anime.id, animeId))
    .get();
  if (!row) return null;
  if (row.coverImagePath) {
    const mime = mimeForDeckImageName(row.coverImagePath);
    const path = join(animeCoverFolder(), row.coverImagePath);
    if (mime && existsSync(path)) return { kind: "file", path, mime };
  }
  return row.coverImageUrl ? { kind: "remote", url: row.coverImageUrl } : null;
}
