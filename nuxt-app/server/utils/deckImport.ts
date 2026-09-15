import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative } from "node:path";
import { cardExistsForSong, createCard } from "./cards.ts";
import { filterClipUrls } from "./clipSource.ts";
import type { DeckBundleManifest } from "./deckExport.ts";
import { findAnimeByAniListId, findSongByAnimeAndSlot, getArtistById, getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { getClipSource, getDefaultDownloadFolder } from "./mediaLibrary.ts";
import { resolveUniquePath, sanitizeSegment } from "./mediaDownload.ts";

// Mirrors mediaLibrary.ts's isPathWithinLibrary - a manifest is untrusted
// content, so a bundled path must be proven to stay inside the bundle
// directory before it's ever passed to existsSync/copyFileSync.
function isWithinDir(baseDir: string, candidatePath: string): boolean {
  const rel = relative(baseDir, candidatePath);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

export interface ImportBundleSummary {
  created: number;
  skipped: number;
  errors: string[];
}

export type ImportBundleResult = { error: string } | ImportBundleSummary;

export function importBundle(sourcePath: string): ImportBundleResult {
  if (!isAbsolute(sourcePath)) {
    return { error: "Source path must be absolute." };
  }

  const manifestPath = join(sourcePath, "manifest.json");
  if (!existsSync(manifestPath)) {
    return { error: "No manifest.json found at the given path." };
  }

  let manifest: DeckBundleManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    return { error: "manifest.json is not valid JSON." };
  }

  if (manifest.version !== 1 || !Array.isArray(manifest.cards)) {
    return { error: "manifest.json has an unrecognized format." };
  }

  const defaultFolder = getDefaultDownloadFolder();
  const clipSource = getClipSource();
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of manifest.cards) {
    const label = `${entry?.anime?.titleRomaji ?? "unknown anime"} - ${entry?.song?.themeSlot ?? "?"}`;
    try {
      // A bundle is stale, non-authoritative data (unlike a live AniList/
      // animethemes.moe lookup): resolve an existing anime/song by identity
      // first and leave it untouched, only inserting when genuinely new, so
      // reimporting an old bundle can never overwrite metadata edited since.
      const animeRow = findAnimeByAniListId(entry.anime.aniListId) ??
        upsertAnime({
          aniListId: entry.anime.aniListId,
          animethemesId: entry.anime.animethemesId,
          titleEnglish: entry.anime.titleEnglish,
          titleRomaji: entry.anime.titleRomaji,
          titleNative: entry.anime.titleNative,
        });
      let songRow = findSongByAnimeAndSlot(animeRow.id, entry.song.themeSlot);
      if (!songRow) {
        // Only get-or-create the artist when a song row actually needs one -
        // an existing (soon to be skipped) song must not spawn a stray
        // artist row from a bundle's stale name.
        const artistRow = getOrCreateArtist(entry.artistName);
        songRow = upsertSong({
          animeId: animeRow.id,
          artistId: artistRow.id,
          title: entry.song.title,
          themeSlot: entry.song.themeSlot,
          animethemesThemeId: entry.song.animethemesThemeId,
        });
      }

      if (cardExistsForSong(songRow.id)) {
        skipped += 1;
        continue;
      }

      // Use the song's actual current artist (it may have been reassigned
      // since export - feature 16), not the bundle's possibly-stale name.
      const artistRow = getArtistById(songRow.artistId);

      let localAudioPath: string | null = null;
      if (entry.audioFile && defaultFolder && artistRow) {
        const bundledPath = join(sourcePath, entry.audioFile);
        if (isWithinDir(sourcePath, bundledPath) && existsSync(bundledPath)) {
          const baseName = `${sanitizeSegment(animeRow.titleRomaji)} - ${sanitizeSegment(songRow.themeSlot)} - ${sanitizeSegment(artistRow.name)}`;
          const ext = extname(bundledPath) || ".mp3";
          const destPath = resolveUniquePath(defaultFolder, baseName, ext);
          copyFileSync(bundledPath, destPath);
          localAudioPath = destPath;
        }
      }

      const { videoUrl: animethemesVideoUrl, audioUrl: animethemesAudioUrl } =
        filterClipUrls(entry.animethemesVideoUrl, entry.animethemesAudioUrl, clipSource);

      const result = createCard({
        songId: songRow.id,
        localAudioPath,
        animethemesVideoUrl,
        animethemesAudioUrl,
      });

      if ("card" in result) {
        created += 1;
      } else if ("error" in result) {
        errors.push(`${label}: ${result.error}`);
      } else {
        errors.push(`${label}: song not found after import`);
      }
    } catch (err) {
      errors.push(`${label}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  return { created, skipped, errors };
}
