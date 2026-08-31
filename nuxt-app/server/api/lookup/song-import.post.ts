import { fetchAnimeFromAniList } from "../../lib/anilist.ts";
import { getCardsBySongIds } from "../../utils/cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (
    !body ||
    typeof body.animeAniListId !== "number" ||
    typeof body.animeAnimethemesId !== "number" ||
    typeof body.themeSlot !== "string" ||
    typeof body.animethemesThemeId !== "number"
  ) {
    throw createError({ statusCode: 400, statusMessage: "Invalid song import request" });
  }

  const aniListAnime = await fetchAnimeFromAniList(body.animeAniListId);
  if (!aniListAnime) {
    throw createError({ statusCode: 404, statusMessage: "Anime not found on AniList" });
  }

  const animeRow = upsertAnime({
    aniListId: aniListAnime.aniListId,
    animethemesId: body.animeAnimethemesId,
    titleEnglish: aniListAnime.titleEnglish,
    titleRomaji: aniListAnime.titleRomaji,
    titleNative: aniListAnime.titleNative,
    coverImageUrl: aniListAnime.coverImageUrl,
  });

  const artistRow = getOrCreateArtist(body.artistName ?? "Unknown Artist");

  const songRow = upsertSong({
    animeId: animeRow.id,
    artistId: artistRow.id,
    title: body.songTitle ?? body.themeSlot,
    titleNative: body.songTitleNative,
    themeSlot: body.themeSlot,
    animethemesThemeId: body.animethemesThemeId,
  });

  return {
    songId: songRow.id,
    themeSlot: songRow.themeSlot,
    songTitle: songRow.title,
    artistName: artistRow.name,
    videoUrl: body.videoUrl ?? null,
    audioUrl: body.audioUrl ?? null,
    existingCard: getCardsBySongIds([songRow.id])[0] ?? null,
  };
});
