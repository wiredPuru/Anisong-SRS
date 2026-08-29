import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, isAbsolute, join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../db/client.ts";
import { anime, artist, card, song } from "../db/schema.ts";
import { normalizeFolderPath } from "./mediaLibrary.ts";

export type DeckExportScope = { type: "artist"; id: number } | { type: "anime"; id: number };

export interface DeckBundleManifest {
  version: 1;
  exportedAt: string;
  scope: DeckExportScope;
  cards: DeckBundleCardEntry[];
}

export interface DeckBundleCardEntry {
  anime: {
    aniListId: number;
    animethemesId: number | null;
    titleEnglish: string;
    titleRomaji: string;
    titleNative: string;
  };
  artistName: string;
  song: { title: string; themeSlot: string; animethemesThemeId: number | null };
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  audioFile: string | null;
}

const exportSelection = {
  cardId: card.id,
  localAudioPath: card.localAudioPath,
  animethemesVideoUrl: card.animethemesVideoUrl,
  animethemesAudioUrl: card.animethemesAudioUrl,
  aniListId: anime.aniListId,
  animethemesId: anime.animethemesId,
  titleEnglish: anime.titleEnglish,
  titleRomaji: anime.titleRomaji,
  titleNative: anime.titleNative,
  artistName: artist.name,
  songTitle: song.title,
  themeSlot: song.themeSlot,
  animethemesThemeId: song.animethemesThemeId,
};

function queryExportRows(scope: DeckExportScope) {
  const scopeCondition = scope.type === "artist" ? eq(artist.id, scope.id) : eq(anime.id, scope.id);

  return db
    .select(exportSelection)
    .from(card)
    .innerJoin(song, eq(card.songId, song.id))
    .innerJoin(artist, eq(song.artistId, artist.id))
    .innerJoin(anime, eq(song.animeId, anime.id))
    .where(scopeCondition)
    .all();
}

export type ExportDeckResult =
  | { error: string }
  | { exportedTo: string; cardCount: number; audioFileCount: number };

export function exportDeck(scope: DeckExportScope, destPath: string, includeAudio: boolean): ExportDeckResult {
  const normalized = normalizeFolderPath(destPath);
  if (!isAbsolute(normalized)) {
    return { error: "Destination path must be absolute." };
  }
  if (existsSync(normalized)) {
    if (!statSync(normalized).isDirectory()) {
      return { error: "Destination path is not a directory." };
    }
    if (readdirSync(normalized).length > 0) {
      return { error: "Destination folder must be empty or not already exist." };
    }
  }

  const rows = queryExportRows(scope);
  mkdirSync(normalized, { recursive: true });

  let audioFileCount = 0;
  const cards: DeckBundleCardEntry[] = rows.map((row) => {
    let audioFile: string | null = null;
    if (includeAudio && row.localAudioPath && existsSync(row.localAudioPath)) {
      const audioDir = join(normalized, "audio");
      mkdirSync(audioDir, { recursive: true });
      const filename = `${row.cardId}-${basename(row.localAudioPath)}`;
      copyFileSync(row.localAudioPath, join(audioDir, filename));
      audioFile = `audio/${filename}`;
      audioFileCount += 1;
    }

    return {
      anime: {
        aniListId: row.aniListId,
        animethemesId: row.animethemesId,
        titleEnglish: row.titleEnglish,
        titleRomaji: row.titleRomaji,
        titleNative: row.titleNative,
      },
      artistName: row.artistName,
      song: { title: row.songTitle, themeSlot: row.themeSlot, animethemesThemeId: row.animethemesThemeId },
      animethemesVideoUrl: row.animethemesVideoUrl,
      animethemesAudioUrl: row.animethemesAudioUrl,
      audioFile,
    };
  });

  const manifest: DeckBundleManifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    scope,
    cards,
  };
  writeFileSync(join(normalized, "manifest.json"), JSON.stringify(manifest, null, 2));

  return { exportedTo: normalized, cardCount: cards.length, audioFileCount };
}
