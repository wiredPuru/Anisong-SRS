import { fetchAnimeFromAniList } from "../../lib/anilist.ts";
import { fetchArtistThemesBySlug } from "../../lib/animethemes.ts";
import { getOrCreateArtist, upsertAnime, upsertSong } from "../../utils/lookup.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.artistSlug !== "string" || !body.artistSlug.trim()) {
    throw createError({ statusCode: 400, statusMessage: "artistSlug is required and must be a string" });
  }

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

  for (const [aniListId, entries] of entriesByAniListId) {
    let aniListAnime;
    try {
      aniListAnime = await fetchAnimeFromAniList(aniListId);
    } catch {
      // AniList lookup failed for this one anime (404, rate limit, network
      // error) - skip just this group rather than aborting the whole
      // artist's import over one anime out of potentially dozens.
      continue;
    }
    if (!aniListAnime) {
      continue;
    }

    const animeRow = upsertAnime({
      aniListId: aniListAnime.aniListId,
      animethemesId: entries[0]!.animeAnimethemesId,
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
  }

  return { artistName: artistThemes.artistName, animeGroups };
});
