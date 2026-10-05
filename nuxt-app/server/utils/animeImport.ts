import { createAnimeMetadataResolver } from "./animeMetadata.ts";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.ts";
import { card } from "../db/schema.ts";
import { cardExistsForSong, createCard } from "./cards.ts";
import { filterClipUrls } from "./clipSource.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "./lookup.ts";
import { getClipSource, getIncludeInsertSongs, getThemesOnly } from "./mediaLibrary.ts";
import { isMissingAnimeThemesMatch, resolveThemes } from "./themeSource.ts";
import { saveAnimeCoverInBackground } from "./animeCoverSave.ts";

export interface ImportedTheme {
  songId: number;
  themeSlot: string;
  songTitle: string;
  artistName: string;
  videoUrl: string | null;
  audioUrl: string | null;
  clipBlocked: boolean;
  noAnimethemesMatch: boolean;
}

export interface ImportedAnime {
  anime: {
    id: number;
    aniListId: number;
    animethemesId: number | null;
    titleEnglish: string;
    titleRomaji: string;
    titleNative: string;
  };
  themes: ImportedTheme[];
}

/** Looks one anime up and stores it with its themes; null when no provider knows it. */
export async function importAnimeThemes(aniListId: number): Promise<ImportedAnime | null> {
  const metadata = createAnimeMetadataResolver();
  const aniListAnime = await metadata.byAniListId(aniListId);
  if (!aniListAnime) return null;

  const resolved = await resolveThemes({
    aniListId,
    malId: aniListAnime.malId ?? null,
    includeInserts: getIncludeInsertSongs(),
  });
  const clipSource = getClipSource();
  const themesOnly = getThemesOnly();

  const animeRow = upsertAnime({
    aniListId: aniListAnime.aniListId,
    animethemesId: resolved.animethemesId ?? aniListAnime.animethemesId ?? null,
    titleEnglish: aniListAnime.titleEnglish,
    titleRomaji: aniListAnime.titleRomaji,
    titleNative: aniListAnime.titleNative,
    animethemesSlug: resolved.animethemesSlug,
    coverImageUrl: aniListAnime.coverImageUrl,
    details: aniListAnime.details,
  });
  saveAnimeCoverInBackground(animeRow.id);

  const themes = resolved.themes.map((theme) => {
    // A theme with a title but no credited artist still needs a Song.artistId
    // (NOT NULL). Not hit in real testing (Kessoku Band was always present).
    const artistRow = getOrCreateArtist(theme.artistName ?? "Unknown Artist");
    const songRow = upsertSong({
      animeId: animeRow.id,
      artistId: artistRow.id,
      title: theme.songTitle ?? theme.themeSlot,
      titleNative: theme.songTitleNative,
      themeSlot: theme.themeSlot,
      animethemesThemeId: theme.animethemesThemeId,
      animethemesVideoSlug: theme.animethemesVideoSlug,
    });

    const { videoUrl, audioUrl, clipBlocked } = filterClipUrls(theme.videoUrl, theme.audioUrl, clipSource);

    return {
      songId: songRow.id,
      themeSlot: theme.themeSlot,
      songTitle: songRow.title,
      artistName: artistRow.name,
      videoUrl,
      audioUrl,
      clipBlocked,
      noAnimethemesMatch: themesOnly && isMissingAnimeThemesMatch({
        storedThemeId: songRow.animethemesThemeId,
        unavailable: resolved.animethemesUnavailable,
      }),
    };
  });

  return {
    anime: {
      id: animeRow.id,
      aniListId: animeRow.aniListId,
      animethemesId: animeRow.animethemesId,
      titleEnglish: animeRow.titleEnglish,
      titleRomaji: animeRow.titleRomaji,
      titleNative: animeRow.titleNative,
    },
    themes,
  };
}

export interface AddCardsResult {
  added: number;
  alreadyAdded: number;
  skipped: number;
  // Every card for these themes after the run, new or already there.
  cardIds: number[];
}

/** Adds a card per theme the way a manual "Add all" does, skipping what cannot be played or is gated. */
export function addCardsForThemes(themes: ImportedTheme[]): AddCardsResult {
  const result: AddCardsResult = { added: 0, alreadyAdded: 0, skipped: 0, cardIds: [] };
  for (const theme of themes) {
    if (cardExistsForSong(theme.songId)) {
      result.alreadyAdded += 1;
    } else if (theme.clipBlocked || theme.noAnimethemesMatch) {
      result.skipped += 1;
    } else if ("card" in createCard({ songId: theme.songId, animethemesVideoUrl: theme.videoUrl, animethemesAudioUrl: theme.audioUrl })) {
      result.added += 1;
    } else {
      result.skipped += 1;
    }
  }
  if (themes.length) {
    result.cardIds = db
      .select({ id: card.id })
      .from(card)
      .where(inArray(card.songId, themes.map((theme) => theme.songId)))
      .all()
      .map((row) => row.id);
  }
  return result;
}
