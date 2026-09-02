import { USER_AGENT } from "../utils/mediaDownload.ts";

const ANILIST_ENDPOINT = "https://graphql.anilist.co";

export interface AniListAnime {
  aniListId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
  coverImageUrl: string | null;
}

interface AniListMediaTitle {
  romaji: string;
  english: string | null;
  native: string | null;
}

interface AniListMediaCoverImage {
  large: string | null;
}

interface AniListMedia {
  id: number;
  title: AniListMediaTitle;
  coverImage?: AniListMediaCoverImage;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: unknown[];
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

async function postToAniList<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<{ status: number; body: GraphQLResponse<T> }> {
  const response = await fetch(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as GraphQLResponse<T>;
  return { status: response.status, body };
}

function toAniListAnime(media: AniListMedia): AniListAnime {
  return {
    aniListId: media.id,
    titleRomaji: media.title.romaji,
    titleEnglish: media.title.english,
    titleNative: media.title.native,
    coverImageUrl: media.coverImage?.large ?? null,
  };
}

export async function searchAnimeOnAniList(query: string): Promise<AniListAnime[]> {
  const { status, body } = await postToAniList<{ Page: { media: AniListMedia[] } }>(SEARCH_QUERY, {
    search: query,
    perPage: 10,
  });

  if (status !== 200 || !body.data) {
    throw new Error(`AniList search failed with status ${status}`);
  }

  return body.data.Page.media.map(toAniListAnime);
}

export async function fetchAnimeFromAniList(aniListId: number): Promise<AniListAnime | null> {
  const { status, body } = await postToAniList<{ Media: AniListMedia | null }>(BY_ID_QUERY, {
    id: aniListId,
  });

  if (status === 404) {
    return null;
  }

  if (status !== 200 || !body.data) {
    throw new Error(`AniList lookup failed with status ${status}`);
  }

  return body.data.Media ? toAniListAnime(body.data.Media) : null;
}
