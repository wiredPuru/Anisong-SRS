import { createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import { getCardsBySongIds } from "../../utils/cards.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.animeAniListId !== "number" || typeof body.themeSlot !== "string" || !body.themeSlot.trim()) {
    throw createError({ statusCode: 400, statusMessage: "Invalid song import request" });
  }

  // An AnisongDB result carries neither id. Both columns tolerate null, and
  // upsertAnime/upsertSong drop a null from their update set rather than
  // erasing what an earlier AnimeThemes import stored.
  const animethemesThemeId = typeof body.animethemesThemeId === "number" ? body.animethemesThemeId : null;
  const animeAnimethemesId = typeof body.animeAnimethemesId === "number" ? body.animeAnimethemesId : null;

  const metadata = createAnimeMetadataResolver();
  const aniListAnime = await metadata.byAniListId(body.animeAniListId);
  if (!aniListAnime) {
    throw createError({ statusCode: 404, statusMessage: "Anime has no matching metadata" });
  }

  const animeRow = upsertAnime({
    aniListId: aniListAnime.aniListId,
    animethemesId: aniListAnime.animethemesId ?? animeAnimethemesId,
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
    animethemesThemeId,
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
