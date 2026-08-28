import { fetchAnimeFromAniList } from "../../lib/anilist.ts";
import { fetchAnimeThemesByAniListId } from "../../lib/animethemes.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.aniListId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "aniListId is required and must be a number" });
  }

  const aniListAnime = await fetchAnimeFromAniList(body.aniListId);
  if (!aniListAnime) {
    throw createError({ statusCode: 404, statusMessage: "Anime not found on AniList" });
  }

  const animethemesResult = await fetchAnimeThemesByAniListId(body.aniListId);

  const animeRow = upsertAnime({
    aniListId: aniListAnime.aniListId,
    animethemesId: animethemesResult?.animethemesId ?? null,
    titleEnglish: aniListAnime.titleEnglish,
    titleRomaji: aniListAnime.titleRomaji,
    titleNative: aniListAnime.titleNative,
  });

  const themes = (animethemesResult?.themes ?? []).map((theme) => {
    // A theme with a title but no credited artist still needs a Song.artistId
    // (NOT NULL). Not hit in real testing (Kessoku Band was always present).
    const artistRow = getOrCreateArtist(theme.artistName ?? "Unknown Artist");
    const songRow = upsertSong({
      animeId: animeRow.id,
      artistId: artistRow.id,
      title: theme.songTitle ?? theme.themeSlot,
      themeSlot: theme.themeSlot,
      animethemesThemeId: theme.animethemesThemeId,
    });

    return {
      songId: songRow.id,
      themeSlot: theme.themeSlot,
      songTitle: songRow.title,
      artistName: artistRow.name,
      videoUrl: theme.videoUrl,
      audioUrl: theme.audioUrl,
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
