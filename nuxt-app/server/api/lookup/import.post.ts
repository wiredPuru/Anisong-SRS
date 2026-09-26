import { createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import { filterClipUrls } from "../../utils/clipSource.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";
import { getClipSource, getIncludeInsertSongs, getThemesOnly } from "../../utils/mediaLibrary.ts";
import { isMissingAnimeThemesMatch, resolveThemes } from "../../utils/themeSource.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.aniListId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "aniListId is required and must be a number" });
  }

  const metadata = createAnimeMetadataResolver();
  const aniListAnime = await metadata.byAniListId(body.aniListId);
  if (!aniListAnime) {
    throw createError({ statusCode: 404, statusMessage: "Anime has no matching metadata" });
  }

  const resolved = await resolveThemes({
    aniListId: body.aniListId,
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
});
