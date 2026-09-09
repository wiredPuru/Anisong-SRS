import { isRecord, postGraphQL, ProviderUnavailableError } from "./graphql.ts";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface AniListAnime {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null;
}

let unavailableUntil = 0;
let recoveryInFlight = false;

async function requestAniList<T>(
  query: string,
  variables: Record<string, unknown>,
  parse: (data: Record<string, unknown> | null) => T,
  allowNotFound = false,
): Promise<T> {
  if (Date.now() < unavailableUntil || recoveryInFlight) {
    throw new ProviderUnavailableError("AniList", Math.max(0, unavailableUntil - Date.now()));
  }
  const availabilityAtStart = unavailableUntil;
  const recovering = unavailableUntil > 0;
  if (recovering) recoveryInFlight = true;
  try {
    const result = parse(await postGraphQL(ANILIST_ENDPOINT, "AniList", query, variables, allowNotFound));
    if (unavailableUntil === availabilityAtStart) unavailableUntil = 0;
    return result;
  } catch (error) {
    if (error instanceof ProviderUnavailableError) {
      unavailableUntil = Math.max(unavailableUntil, Date.now() + Math.max(60_000, error.retryAfterMs));
    }
    throw error;
  } finally {
    if (recovering) recoveryInFlight = false;
  }
}

const SEARCH_QUERY = `
  query ($search: String, $perPage: Int) {
    Page(perPage: $perPage) {
      media(search: $search, type: ANIME) {
        id
        title { romaji english native }
      }
    }
  }
`;

const BY_ID_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      title { romaji english native }
      coverImage { large }
    }
  }
`;

function toAniListAnime(media: unknown): AniListAnime {
  if (!isRecord(media) || !Number.isSafeInteger(media.id) || Number(media.id) <= 0 ||
    !isRecord(media.title) || typeof media.title.romaji !== "string" || !media.title.romaji.trim() ||
    ![media.title.english, media.title.native].every((title) => title == null || typeof title === "string") ||
    (media.coverImage != null && (!isRecord(media.coverImage) ||
      (media.coverImage.large != null && typeof media.coverImage.large !== "string")))) {
    throw new ProviderUnavailableError("AniList");
  }
  return {
    aniListId: Number(media.id),
    titleRomaji: media.title.romaji,
    titleEnglish: typeof media.title.english === "string" ? media.title.english : null,
    titleNative: typeof media.title.native === "string" ? media.title.native : null,
    coverImageUrl: isRecord(media.coverImage) && typeof media.coverImage.large === "string" ? media.coverImage.large : null,
  };
}

export async function searchAnimeOnAniList(query: string): Promise<AniListAnime[]> {
  return requestAniList(SEARCH_QUERY, { search: query, perPage: 10 }, (data) => {
    if (!isRecord(data?.Page) || !Array.isArray(data.Page.media)) throw new ProviderUnavailableError("AniList");
    return data.Page.media.map(toAniListAnime);
  });
}

function parseAnime(data: Record<string, unknown> | null): AniListAnime | null {
  if (data === null || data.Media === null) return null;
  return toAniListAnime(data.Media);
}

export async function fetchAnimeFromAniList(aniListId: number): Promise<AniListAnime | null> {
  return requestAniList(BY_ID_QUERY, { id: aniListId }, (data) => {
    const anime = parseAnime(data);
    if (anime && anime.aniListId !== aniListId) throw new ProviderUnavailableError("AniList");
    return anime;
  }, true);
}

const COMPLETED_LIST_QUERY = `
  query ($userName: String, $status: MediaListStatus) {
    MediaListCollection(userName: $userName, type: ANIME, status: $status) {
      lists {
        entries {
          media {
            id
            title { romaji english native }
            coverImage { large }
          }
        }
      }
    }
  }
`;

export class AniListUserNotFoundError extends Error {}

export async function fetchAniListCompletedList(userName: string): Promise<AniListAnime[]> {
  return requestAniList(COMPLETED_LIST_QUERY, { userName, status: "COMPLETED" }, (data) => {
    if (data === null) throw new AniListUserNotFoundError(`AniList user "${userName}" not found`);
    const collection = data.MediaListCollection;
    if (!isRecord(collection) || !Array.isArray(collection.lists)) throw new ProviderUnavailableError("AniList");
    return collection.lists.flatMap((list: unknown) => {
      if (!isRecord(list) || !Array.isArray(list.entries)) throw new ProviderUnavailableError("AniList");
      return list.entries.map((entry: unknown) => toAniListAnime(isRecord(entry) ? entry.media : undefined));
    });
  }, true);
}

const BY_MAL_ID_QUERY = `
  query ($idMal: Int) {
    Media(idMal: $idMal, type: ANIME) {
      id
      title { romaji english native }
      coverImage { large }
    }
  }
`;

// Used to resolve a MyAnimeList id (from the Jikan-backed MAL import) to its
// AniList counterpart, since every Anime row in this app is keyed by
// aniListId, not a MAL id. type: ANIME disambiguates idMal, which is not
// unique across AniList's anime/manga media pool on its own.
export async function fetchAnimeFromAniListByMalId(malId: number): Promise<AniListAnime | null> {
  return requestAniList(BY_MAL_ID_QUERY, { idMal: malId }, parseAnime, true);
}
