import { readdirSync } from "node:fs";
import { join } from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import {
  clipKindForFile,
  planLibraryScan,
  selectRecoverActions,
  type LibraryScanResponse,
  type RecoverResult,
} from "./libraryScan.ts";
import { getLibraryPaths } from "./mediaLibrary.ts";

export const MAX_SCAN_FILES = 20_000;

interface Listing {
  files: string[];
  unreadableFolders: string[];
  truncated: boolean;
}

// Symlinked directories are not followed, so a link cycle cannot loop forever.
export function listLibraryFiles(folders: string[]): Listing {
  const listing: Listing = { files: [], unreadableFolders: [], truncated: false };
  const pending = [...folders];
  while (pending.length) {
    const dir = pending.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      listing.unreadableFolders.push(dir);
      continue;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile() && clipKindForFile(entry.name)) {
        if (listing.files.length >= MAX_SCAN_FILES) {
          listing.truncated = true;
          return listing;
        }
        listing.files.push(path);
      }
    }
  }
  return listing;
}

export function loadLibraryScan(): LibraryScanResponse {
  const { files, unreadableFolders, truncated } = listLibraryFiles(getLibraryPaths());

  const songs = db
    .select({
      songId: song.id,
      songTitle: song.title,
      animeTitleRomaji: anime.titleRomaji,
      themeSlot: song.themeSlot,
      artistName: artist.name,
    })
    .from(song)
    .innerJoin(anime, eq(anime.id, song.animeId))
    .innerJoin(artist, eq(artist.id, song.artistId))
    .all();

  const cards = db
    .select({ id: card.id, songId: card.songId, localVideoPath: card.localVideoPath, localAudioPath: card.localAudioPath })
    .from(card)
    .all();

  return { ...planLibraryScan({ files, songs, cards }), unreadableFolders, truncated };
}

export function applyLibraryScan(paths: string[]): RecoverResult {
  const actions = selectRecoverActions(loadLibraryScan(), paths);
  let created = 0;
  let attached = 0;

  db.transaction((tx) => {
    for (const entry of actions.create) {
      tx.insert(card)
        .values({ songId: entry.songId, localVideoPath: entry.videoPath, localAudioPath: entry.audioPath })
        .run();
      created += 1;
    }
    for (const entry of actions.attach) {
      const column = entry.kind === "video" ? card.localVideoPath : card.localAudioPath;
      const set = entry.kind === "video" ? { localVideoPath: entry.path } : { localAudioPath: entry.path };
      const result = tx.update(card).set(set).where(and(eq(card.id, entry.cardId), isNull(column))).run();
      if (result.changes > 0) attached += 1;
      else actions.skipped.push(entry.path);
    }
  });

  return { created, attached, skipped: actions.skipped };
}
