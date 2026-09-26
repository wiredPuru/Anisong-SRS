import { fetchArtistThemesBySlug, searchArtistsOnAnimeThemes } from "../lib/animethemes.ts";
import { fetchArtistCatalog, searchArtists, type ThemeOptions } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";

// A candidate has to say where it came from: the two providers key artists
// differently (AnisongDB by numeric id, AnimeThemes by slug), and the import
// that follows has to address whichever one produced it.
export interface ArtistCandidate {
  source: "anisongdb" | "animethemes";
  id: number;
  name: string;
  slug: string | null;
}

export function isArtistCandidate(value: unknown): value is ArtistCandidate {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    (candidate.source === "anisongdb" || candidate.source === "animethemes") &&
    typeof candidate.id === "number" &&
    Number.isSafeInteger(candidate.id) &&
    candidate.id > 0 &&
    typeof candidate.name === "string" &&
    !!candidate.name.trim() &&
    (candidate.slug === null || typeof candidate.slug === "string") &&
    (candidate.source === "anisongdb" || typeof candidate.slug === "string")
  );
}

export async function searchArtistCandidates(query: string, options: ThemeOptions = {}): Promise<ArtistCandidate[]> {
  try {
    return (await searchArtists(query, options)).map((artist) => ({
      source: "anisongdb" as const,
      id: artist.id,
      name: artist.name,
      slug: null,
    }));
  } catch (error) {
    // Only an outage falls back; a rejected request is a real fault. Same rule
    // the song search and the per-anime import already follow.
    if (!(error instanceof ProviderUnavailableError)) throw error;
    return (await searchArtistsOnAnimeThemes(query)).map((artist) => ({
      source: "animethemes" as const,
      id: artist.id,
      name: artist.name,
      slug: artist.slug,
    }));
  }
}

// Today's ArtistThemesResult, widened where AnisongDB cannot fill a field.
export interface ResolvedArtistEntry {
  animethemesThemeId: number | null;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  animeAniListId: number;
  animeAnimethemesId: number | null;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

export interface ResolvedArtistThemes {
  artistName: string;
  entries: ResolvedArtistEntry[];
}

// AnisongDB carries no native song title and no AnimeThemes ids. Nothing reads
// either id (both are external-reference bookkeeping, round-tripped by deck
// export and otherwise only written), and AnimeThemes itself has a native song
// title for 4 of 113 sampled artist themes, so recovering them would mean an
// artist-search hop plus a catalog fetch (3.8-6.3s measured) to improve a field
// that is already empty 96% of the time. Song.titleNative falls back to the
// romaji title, which is what Study and Preview show for those songs today.
export async function resolveArtistThemes(candidate: ArtistCandidate, options: ThemeOptions = {}): Promise<ResolvedArtistThemes | null> {
  if (candidate.source === "animethemes") {
    const result = candidate.slug === null ? null : await fetchArtistThemesBySlug(candidate.slug);
    return result && { artistName: result.artistName, entries: result.entries };
  }

  return {
    artistName: candidate.name,
    entries: (await fetchArtistCatalog(candidate.id, options)).map((theme) => ({
      animethemesThemeId: null,
      themeSlot: theme.themeSlot,
      songTitle: theme.songTitle,
      songTitleNative: null,
      animeAniListId: theme.animeAniListId,
      animeAnimethemesId: null,
      animeTitleRomaji: theme.animeTitleRomaji,
      videoUrl: theme.videoUrl,
      audioUrl: theme.audioUrl,
    })),
  };
}
