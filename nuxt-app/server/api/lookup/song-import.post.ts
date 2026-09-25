import { createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import { getCardsBySongIds } from "../../utils/cards.ts";
import { filterClipUrls } from "../../utils/clipSource.ts";
import { getOrCreateArtist, setAnimeAnimethemesSlug, upsertAnime, upsertSong } from "../../utils/lookup.ts";
import { getClipSource, getThemesOnly } from "../../utils/mediaLibrary.ts";
import { findThemeMatch, isMissingAnimeThemesMatch, loadAnimeThemesMatchIndex, matchLinkSlugs } from "../../utils/themeSource.ts";

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

  const upsertWith = (themeId: number | null, videoSlug: string | null = null) => upsertSong({
    animeId: animeRow.id,
    artistId: artistRow.id,
    title: body.songTitle ?? body.themeSlot,
    titleNative: body.songTitleNative,
    themeSlot: body.themeSlot,
    animethemesThemeId: themeId,
    animethemesVideoSlug: videoSlug,
  });

  let songRow = upsertWith(animethemesThemeId);
  const existingCard = getCardsBySongIds([songRow.id])[0] ?? null;

  // A known match settles eligibility, but can still lack the page slugs.
  const needsMatch = !existingCard && songRow.animethemesThemeId === null;
  const needsLinks = !animeRow.animethemesSlug || !songRow.animethemesVideoSlug;
  let noAnimethemesMatch = false;
  if (needsMatch || needsLinks) {
    const index = await loadAnimeThemesMatchIndex(animeRow.aniListId);
    const matchedThemeId = songRow.animethemesThemeId
      ?? findThemeMatch(index, body.songTitle ?? null) ?? findThemeMatch(index, songRow.title);
    const slugs = matchLinkSlugs(index, matchedThemeId);
    setAnimeAnimethemesSlug(animeRow.id, slugs.animethemesSlug);
    if (matchedThemeId !== null && index.status === "ok") songRow = upsertWith(matchedThemeId, slugs.animethemesVideoSlug);
    noAnimethemesMatch = needsMatch && getThemesOnly() && isMissingAnimeThemesMatch({
      storedThemeId: matchedThemeId,
      unavailable: index.status === "unavailable",
    });
  }

  // Re-filter rather than trust the request body: the client just echoes back
  // a search result, and the setting can have changed since that search ran.
  const { videoUrl, audioUrl } = filterClipUrls(body.videoUrl ?? null, body.audioUrl ?? null, getClipSource());

  return {
    songId: songRow.id,
    themeSlot: songRow.themeSlot,
    songTitle: songRow.title,
    artistName: artistRow.name,
    videoUrl,
    audioUrl,
    existingCard: existingCard ? getCardsBySongIds([songRow.id])[0] ?? existingCard : null,
    noAnimethemesMatch,
  };
});
