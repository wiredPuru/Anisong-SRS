import { isRecord, postGraphQL, ProviderUnavailableError } from "./graphql.ts";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface AnimeTag {
  name: string;
  rank: number;
}

export interface AniListDetails {
  year: number | null;
  format: string | null;
  averageScore: number | null;
  genres: string[];
  tags: AnimeTag[];
}

export interface AniListAnime {
  aniListId: number;
  malId: number | null;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null;
  // Only the by-id queries select these; see DETAILS_FIELDS.
  details?: AniListDetails;
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

// Study filters (feature 76) read these. seasonYear is null for most movies
// and OVAs, which is why startDate.year is selected as its fallback.
const DETAILS_FIELDS = `
      seasonYear
      startDate { year }
      format
      averageScore
      genres
      tags { name rank }
`;

const BY_ID_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      idMal
      title { romaji english native }
      coverImage { large }
      ${DETAILS_FIELDS}
    }
  }
`;

const isNullableInt = (value: unknown): value is number | null | undefined => value == null || (typeof value === "number" && Number.isSafeInteger(value));

function isTag(tag: unknown): tag is AnimeTag {
  return isRecord(tag) && typeof tag.name === "string" && typeof tag.rank === "number" && Number.isFinite(tag.rank);
}

// Undefined when the query did not select the details, so a search result is
// never mistaken for an anime AniList reported as having no genres or tags.
function toAniListDetails(media: Record<string, unknown>): AniListDetails | undefined {
  if (!("genres" in media)) return undefined;
  const { seasonYear, startDate, format, averageScore, genres, tags } = media;
  if (!isNullableInt(seasonYear) || !isNullableInt(averageScore) || (format != null && typeof format !== "string") ||
    (startDate != null && (!isRecord(startDate) || !isNullableInt(startDate.year))) ||
    !Array.isArray(genres) || !genres.every((genre) => typeof genre === "string") ||
    !Array.isArray(tags) || !tags.every(isTag)) {
    throw new ProviderUnavailableError("AniList");
  }
  const startYear = isRecord(startDate) && typeof startDate.year === "number" ? startDate.year : null;
  return {
    year: seasonYear ?? startYear,
    format: format ?? null,
    averageScore: averageScore ?? null,
    genres,
    tags: tags.map(({ name, rank }) => ({ name, rank })),
  };
}

function toAniListAnime(media: unknown): AniListAnime {
  if (!isRecord(media) || !Number.isSafeInteger(media.id) || Number(media.id) <= 0 ||
    !isRecord(media.title) || typeof media.title.romaji !== "string" || !media.title.romaji.trim() ||
    ![media.title.english, media.title.native].every((title) => title == null || typeof title === "string") ||
    (media.idMal != null && (typeof media.idMal !== "number" || !Number.isSafeInteger(media.idMal) || media.idMal <= 0)) ||
    (media.coverImage != null && (!isRecord(media.coverImage) ||
      (media.coverImage.large != null && typeof media.coverImage.large !== "string")))) {
    throw new ProviderUnavailableError("AniList");
  }
  return {
    aniListId: Number(media.id),
    // Only the two by-id queries select idMal; the search and Completed-list
    // queries feed candidate pickers that re-fetch by id before importing.
    malId: typeof media.idMal === "number" ? media.idMal : null,
    titleRomaji: media.title.romaji,
    titleEnglish: typeof media.title.english === "string" ? media.title.english : null,
    titleNative: typeof media.title.native === "string" ? media.title.native : null,
    coverImageUrl: isRecord(media.coverImage) && typeof media.coverImage.large === "string" ? media.coverImage.large : null,
    details: toAniListDetails(media),
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
      idMal
      title { romaji english native }
      coverImage { large }
      ${DETAILS_FIELDS}
    }
  }
`;

// Used to resolve a MyAnimeList id (from the MAL Completed-list import) to its
// AniList counterpart, since every Anime row in this app is keyed by
// aniListId, not a MAL id. type: ANIME disambiguates idMal, which is not
// unique across AniList's anime/manga media pool on its own.
export async function fetchAnimeFromAniListByMalId(malId: number): Promise<AniListAnime | null> {
  return requestAniList(BY_MAL_ID_QUERY, { idMal: malId }, parseAnime, true);
}

// AniList's Page caps perPage at 50.
export const ANILIST_DETAILS_BATCH_SIZE = 50;

const DETAILS_BATCH_QUERY = `
  query ($ids: [Int], $perPage: Int) {
    Page(perPage: $perPage) {
      media(id_in: $ids, type: ANIME) {
        id
        ${DETAILS_FIELDS}
      }
    }
  }
`;

// An id AniList does not return is simply absent from the map. Batches run
// sequentially so a large library shares the rate-limit cooldown politely.
export async function fetchAnimeDetailsByIds(ids: number[]): Promise<Map<number, AniListDetails>> {
  const found = new Map<number, AniListDetails>();
  for (let start = 0; start < ids.length; start += ANILIST_DETAILS_BATCH_SIZE) {
    const batch = ids.slice(start, start + ANILIST_DETAILS_BATCH_SIZE);
    const media = await requestAniList(DETAILS_BATCH_QUERY, { ids: batch, perPage: ANILIST_DETAILS_BATCH_SIZE }, (data) => {
      if (!isRecord(data?.Page) || !Array.isArray(data.Page.media)) throw new ProviderUnavailableError("AniList");
      return data.Page.media;
    });
    for (const entry of media) {
      if (!isRecord(entry) || !Number.isSafeInteger(entry.id)) throw new ProviderUnavailableError("AniList");
      const details = toAniListDetails(entry);
      if (!details) throw new ProviderUnavailableError("AniList");
      found.set(Number(entry.id), details);
    }
  }
  return found;
}
