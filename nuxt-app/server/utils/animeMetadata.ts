import { fetchAnimeFromAniList, fetchAnimeFromAniListByMalId, searchAnimeOnAniList, type AniListAnime } from "../lib/anilist.ts";
import { fetchAnimeMetadataFromAnimeThemes, searchAnimeOnAnimeThemes } from "../lib/animethemes.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { findAnimeByAniListId } from "./lookup.ts";

// malId and coverImageUrl are optional because the fallback paths below return
// a stored Anime row or AnimeThemes metadata, neither of which carries them.
export interface AnimeMetadata extends Omit<AniListAnime, "coverImageUrl" | "malId"> {
  coverImageUrl?: string | null;
  malId?: number | null;
  animethemesId?: number | null;
}

export class AnimeLookupUnavailableError extends ProviderUnavailableError {
  constructor() {
    super("Anime metadata lookup");
  }
}

// Each bulk import keeps its fallback decision, even if it outlasts the
// process-wide cooldown. A later request can still probe for recovery.
export function createAnimeMetadataResolver() {
  let primaryUnavailable = false;

  async function resolve(id: number, site: "ANILIST" | "MAL"): Promise<AnimeMetadata | null> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Anime ID must be a positive integer.");
    if (!primaryUnavailable) {
      try {
        return await (site === "ANILIST" ? fetchAnimeFromAniList(id) : fetchAnimeFromAniListByMalId(id));
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) throw error;
        primaryUnavailable = true;
      }
    }
    if (site === "ANILIST") {
      const stored = findAnimeByAniListId(id);
      if (stored) return stored;
    }
    try {
      const fallback = await fetchAnimeMetadataFromAnimeThemes(id, site);
      if (!fallback) return null;
      return findAnimeByAniListId(fallback.aniListId) ?? fallback;
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      throw new AnimeLookupUnavailableError();
    }
  }

  async function search(query: string): Promise<AniListAnime[]> {
    if (!primaryUnavailable) {
      try {
        return await searchAnimeOnAniList(query);
      } catch (error) {
        if (!(error instanceof ProviderUnavailableError)) throw error;
        primaryUnavailable = true;
      }
    }
    let candidates;
    try {
      candidates = await searchAnimeOnAnimeThemes(query);
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError)) throw error;
      throw new AnimeLookupUnavailableError();
    }
    return candidates.map((candidate) => {
      const metadata = findAnimeByAniListId(candidate.aniListId) ?? candidate;
      return {
        aniListId: metadata.aniListId,
        malId: "malId" in metadata ? metadata.malId ?? null : null,
        titleRomaji: metadata.titleRomaji,
        titleEnglish: metadata.titleEnglish,
        titleNative: metadata.titleNative,
        coverImageUrl: "coverImageUrl" in metadata ? metadata.coverImageUrl : null,
      };
    });
  }

  return {
    search,
    byAniListId: (id: number) => resolve(id, "ANILIST"),
    byMalId: (id: number) => resolve(id, "MAL"),
  };
}
