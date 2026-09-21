import { respondWithImportProgress } from "../../utils/importProgress.ts";
import { AnimeLookupUnavailableError, createAnimeMetadataResolver } from "../../utils/animeMetadata.ts";
import { ProviderUnavailableError } from "../../lib/graphql.ts";
import { isArtistCandidate, resolveArtistThemes } from "../../utils/artistSource.ts";
import { filterClipUrls } from "../../utils/clipSource.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";
import { getClipSource } from "../../utils/mediaLibrary.ts";
import { findThemeMatch, isMissingAnimeThemesMatch, startMatchIndexLoads } from "../../utils/themeSource.ts";

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
    const artistThemes = await resolveArtistThemes(candidate);
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

    // AnisongDB entries carry no AnimeThemes id, so each such anime needs its own
    // AnimeThemes lookup to say which of its songs AnimeThemes has.
    const matchIndexes = startMatchIndexLoads(
      [...entriesByAniListId]
        .filter(([, entries]) => entries.some((entry) => entry.animethemesThemeId === null))
        .map(([aniListId]) => aniListId),
    );

    const clipSource = getClipSource();
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

        const matchIndex = await matchIndexes.get(aniListId);

        const themes = entries.map((entry) => {
          const songRow = upsertSong({
            animeId: animeRow.id,
            artistId: artistRow.id,
            title: entry.songTitle ?? entry.themeSlot,
            titleNative: entry.songTitleNative,
            themeSlot: entry.themeSlot,
            animethemesThemeId: entry.animethemesThemeId ?? (matchIndex ? findThemeMatch(matchIndex, entry.songTitle) : null),
          });

          const { videoUrl, audioUrl, clipBlocked } = filterClipUrls(entry.videoUrl, entry.audioUrl, clipSource);

          return {
            songId: songRow.id,
            themeSlot: entry.themeSlot,
            songTitle: songRow.title,
            videoUrl,
            audioUrl,
            clipBlocked,
            noAnimethemesMatch: isMissingAnimeThemesMatch({
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
