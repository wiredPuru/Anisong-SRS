import { respondWithImportProgress } from "../../utils/importProgress.ts";
import { AnimeLookupUnavailableError, createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import { ProviderUnavailableError } from "../../lib/graphql.ts";
import { fetchArtistThemesBySlug } from "../../lib/animethemes.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.artistSlug !== "string" || !body.artistSlug.trim()) {
    throw createError({ statusCode: 400, statusMessage: "artistSlug is required and must be a string" });
  }

  return respondWithImportProgress(event, async (report) => {
    report({ label: "Fetching artist catalog from AnimeThemes" });
    const artistThemes = await fetchArtistThemesBySlug(body.artistSlug.trim());
    if (!artistThemes) {
      throw createError({ statusCode: 404, statusMessage: "Artist not found on animethemes.moe" });
    }

    const artistRow = getOrCreateArtist(artistThemes.artistName);

    const entriesByAniListId = new Map<number, typeof artistThemes.entries>();
    for (const entry of artistThemes.entries) {
      const existing = entriesByAniListId.get(entry.animeAniListId);
      if (existing) {
        existing.push(entry);
      } else {
        entriesByAniListId.set(entry.animeAniListId, [entry]);
      }
    }

    const animeGroups: {
      anime: {
        id: number;
        aniListId: number;
        animethemesId: number | null;
        titleEnglish: string;
        titleRomaji: string;
        titleNative: string;
      };
      themes: {
        songId: number;
        themeSlot: string;
        songTitle: string;
        videoUrl: string | null;
        audioUrl: string | null;
      }[];
    }[] = [];

    const metadata = createAnimeMetadataResolver();
    let unavailableAnimeCount = 0;
    let completed = 0;
    let skipped = 0;
    const reportResolution = () => report({
      label: `Fetching anime details for ${artistThemes.artistName}`,
      completed, total: entriesByAniListId.size, skipped, unavailable: unavailableAnimeCount,
    });
    reportResolution();
    for (const [aniListId, entries] of entriesByAniListId) {
      try {
        let aniListAnime;
        try {
          aniListAnime = await metadata.byAniListId(aniListId);
        } catch (error) {
          if (!(error instanceof ProviderUnavailableError)) throw error;
          unavailableAnimeCount += 1;
          continue;
        }
        if (!aniListAnime) {
          skipped += 1;
          continue;
        }

        const animeRow = upsertAnime({
          aniListId: aniListAnime.aniListId,
          animethemesId: aniListAnime.animethemesId ?? entries[0]!.animeAnimethemesId,
          titleEnglish: aniListAnime.titleEnglish,
          titleRomaji: aniListAnime.titleRomaji,
          titleNative: aniListAnime.titleNative,
          coverImageUrl: aniListAnime.coverImageUrl,
        });

        const themes = entries.map((entry) => {
          const songRow = upsertSong({
            animeId: animeRow.id,
            artistId: artistRow.id,
            title: entry.songTitle ?? entry.themeSlot,
            titleNative: entry.songTitleNative,
            themeSlot: entry.themeSlot,
            animethemesThemeId: entry.animethemesThemeId,
          });

          return {
            songId: songRow.id,
            themeSlot: entry.themeSlot,
            songTitle: songRow.title,
            videoUrl: entry.videoUrl,
            audioUrl: entry.audioUrl,
          };
        });

        animeGroups.push({
          anime: {
            id: animeRow.id,
            aniListId: animeRow.aniListId,
            animethemesId: animeRow.animethemesId,
            titleEnglish: animeRow.titleEnglish,
            titleRomaji: animeRow.titleRomaji,
            titleNative: animeRow.titleNative,
          },
          themes,
        });
      } finally {
        completed += 1;
        reportResolution();
      }
    }

    if (!animeGroups.length && unavailableAnimeCount) throw new AnimeLookupUnavailableError();
    return { artistName: artistThemes.artistName, animeGroups, unavailableAnimeCount };
  });
});
