import { importAnimeThemes } from "../../../utils/animeImport.ts";

// Looks a show up (AniList plus AnisongDB/AnimeThemes) and stores it like the
// /cards search does, so its themes can be picked for the queue.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || typeof body.aniListId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "aniListId is required and must be a number" });
  }
  const imported = await importAnimeThemes(body.aniListId);
  if (!imported) throw createError({ statusCode: 404, statusMessage: "Anime has no matching metadata" });
  return {
    title: imported.anime.titleEnglish,
    themes: imported.themes.map((theme) => ({
      songId: theme.songId,
      themeSlot: theme.themeSlot,
      songTitle: theme.songTitle,
      artistName: theme.artistName,
      videoUrl: theme.videoUrl,
      audioUrl: theme.audioUrl,
      playable: !theme.clipBlocked && !theme.noAnimethemesMatch,
    })),
  };
});
