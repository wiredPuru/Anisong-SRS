import { respondWithImportProgress } from "../../utils/importProgress.ts";
import { AnimeLookupUnavailableError, createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import { ProviderUnavailableError } from "../../lib/graphql.ts";
import { isArtistCandidate, resolveArtistThemes } from "../../utils/artistSource.ts";
import { filterClipUrls } from "../../utils/clipSource.ts";
import { findSongByAnimeAndSlot, getOrCreateArtist, setAnimeAnimethemesSlug, upsertAnime, upsertSong } from "../../utils/lookup.ts";
import { getClipSource, getIncludeInsertSongs, getThemesOnly } from "../../utils/mediaLibrary.ts";
import { findThemeMatch, isMissingAnimeThemesMatch, matchLinkSlugs, startMatchIndexLoads } from "../../utils/themeSource.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // The whole candidate, not just a slug: it names the provider to ask and the
  // id or slug to ask with.
  if (!isArtistCandidate(body?.candidate)) {
    throw createError({ statusCode: 400, statusMessage: "candidate is required and must be an artist search result" });
  }
  const candidate = body.candidate;

  return respondWithImportProgress(event, async (report) => {
    report({ label: `Fetching artist catalog from ${candidate.source === "anisongdb" ? "AnisongDB" : "AnimeThemes"}` });
    const artistThemes = await resolveArtistThemes(candidate, { includeInserts: getIncludeInsertSongs() });
    if (!artistThemes) {
      throw createError({ statusCode: 404, statusMessage: "Artist not found" });
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
        clipBlocked: boolean;
        noAnimethemesMatch: boolean;
      }[];
    }[] = [];

    // Even entries with known theme ids need the provider's page slugs.
    const matchIndexes = startMatchIndexLoads([...entriesByAniListId.keys()]);

    const clipSource = getClipSource();
    const themesOnly = getThemesOnly();
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
          details: aniListAnime.details,
        });

        const matchIndex = await matchIndexes.get(aniListId);
        if (matchIndex) setAnimeAnimethemesSlug(animeRow.id, matchLinkSlugs(matchIndex, null).animethemesSlug);

        const themes = entries.map((entry) => {
          const themeId = entry.animethemesThemeId
            ?? findSongByAnimeAndSlot(animeRow.id, entry.themeSlot)?.animethemesThemeId
            ?? (matchIndex ? findThemeMatch(matchIndex, entry.songTitle, entry.themeSlot) : null);
          const songRow = upsertSong({
            animeId: animeRow.id,
            artistId: artistRow.id,
            title: entry.songTitle ?? entry.themeSlot,
            titleNative: entry.songTitleNative,
            themeSlot: entry.themeSlot,
            animethemesThemeId: themeId,
            animethemesVideoSlug: matchIndex ? matchLinkSlugs(matchIndex, themeId).animethemesVideoSlug : null,
          });

          const { videoUrl, audioUrl, clipBlocked } = filterClipUrls(entry.videoUrl, entry.audioUrl, clipSource);

          return {
            songId: songRow.id,
            themeSlot: entry.themeSlot,
            songTitle: songRow.title,
            videoUrl,
            audioUrl,
            clipBlocked,
            noAnimethemesMatch: themesOnly && isMissingAnimeThemesMatch({
              storedThemeId: songRow.animethemesThemeId,
              unavailable: matchIndex?.status === "unavailable",
            }),
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
