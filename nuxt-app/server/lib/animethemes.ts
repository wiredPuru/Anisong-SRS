const ANIMETHEMES_ENDPOINT = "https://graphql.animethemes.moe";
// animethemes.moe blocks Node's default fetch User-Agent with a bare 403;
// an identifying UA (not a spoofed browser string) passes fine.
const USER_AGENT = "GAQ-SRS/1.0 (personal AMQ study app)";

export interface AnimeThemeLookup {
  animethemesThemeId: number;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}

export interface AnimeThemesResult {
  animethemesId: number;
  themes: AnimeThemeLookup[];
}

interface RawSongTitle {
  romaji: string | null;
  native: string | null;
}

interface RawArtistName {
  main: string;
  native: string | null;
}

interface RawPerformance {
  artist: { name: RawArtistName };
}

interface RawVideoNode {
  link: string;
  audio: { link: string } | null;
}

interface RawAnimeTheme {
  id: number;
  slug: string;
  song: {
    title: RawSongTitle;
    performances: RawPerformance[];
  } | null;
  animethemeentries: {
    videos: { nodes: RawVideoNode[] };
  }[];
}

interface RawAnime {
  id: number;
  animethemes: RawAnimeTheme[];
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: unknown[];
}

const FIND_BY_ANILIST_QUERY = `
  query ($anilistId: [Int!]) {
    findAnimeByExternalSite(site: ANILIST, id: $anilistId) {
      id
      animethemes(first: 50) {
        id
        slug
        song {
          title { romaji native }
          performances {
            artist { name { main native } }
          }
        }
        animethemeentries(first: 1) {
          videos(first: 1) {
            nodes {
              link
              audio { link }
            }
          }
        }
      }
    }
  }
`;

function toThemeLookup(theme: RawAnimeTheme): AnimeThemeLookup | null {
  const songTitle = theme.song?.title.romaji ?? theme.song?.title.native ?? null;
  if (!songTitle) {
    return null;
  }

  const songTitleNative = theme.song?.title.native ?? null;
  const artistName = theme.song?.performances[0]?.artist.name.main ?? null;
  const video = theme.animethemeentries[0]?.videos.nodes[0] ?? null;

  return {
    animethemesThemeId: theme.id,
    themeSlot: theme.slug,
    songTitle,
    songTitleNative,
    artistName,
    videoUrl: video?.link ?? null,
    audioUrl: video?.audio?.link ?? null,
  };
}

export interface AnimeThemesArtistCandidate {
  id: number;
  name: string;
  slug: string;
}

interface RawArtistCandidate {
  id: number;
  name: { main: string };
  slug: string;
}

const ARTIST_SEARCH_QUERY = `
  query ($search: String, $first: Int) {
    artistPagination(search: $search, first: $first) {
      data {
        id
        name { main }
        slug
      }
    }
  }
`;

export async function searchArtistsOnAnimeThemes(query: string): Promise<AnimeThemesArtistCandidate[]> {
  const response = await fetch(ANIMETHEMES_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({
      query: ARTIST_SEARCH_QUERY,
      variables: { search: query, first: 10 },
    }),
  });

  if (!response.ok) {
    throw new Error(`animethemes.moe request failed with status ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<{ artistPagination: { data: RawArtistCandidate[] } }>;

  if (!body.data) {
    throw new Error("animethemes.moe response missing data");
  }

  return body.data.artistPagination.data.map((artist) => ({
    id: artist.id,
    name: artist.name.main,
    slug: artist.slug,
  }));
}

export interface ArtistThemeEntry {
  animethemesThemeId: number;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  animeAniListId: number;
  animeAnimethemesId: number;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

export interface ArtistThemesResult {
  artistName: string;
  entries: ArtistThemeEntry[];
}

interface RawArtistThemesAnime {
  id: number;
  title: { romaji: string };
  resources: { nodes: { externalId: number | null }[] };
}

interface RawArtistThemesTheme {
  id: number;
  slug: string;
  anime: RawArtistThemesAnime;
  animethemeentries: {
    videos: { nodes: RawVideoNode[] };
  }[];
}

interface RawArtistThemesSong {
  title: RawSongTitle;
  animethemes: RawArtistThemesTheme[];
}

interface RawArtistThemesPerformance {
  song: RawArtistThemesSong;
}

interface RawArtistThemes {
  name: { main: string };
  performances: RawArtistThemesPerformance[];
}

const ARTIST_THEMES_QUERY = `
  query ($slug: String!) {
    artist(slug: $slug) {
      name { main }
      performances {
        song {
          title { romaji native }
          animethemes {
            id
            slug
            anime {
              id
              title { romaji }
              resources(site: ANILIST, first: 1) { nodes { externalId } }
            }
            animethemeentries(first: 1) {
              videos(first: 1) {
                nodes {
                  link
                  audio { link }
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function fetchArtistThemesBySlug(slug: string): Promise<ArtistThemesResult | null> {
  const response = await fetch(ANIMETHEMES_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({
      query: ARTIST_THEMES_QUERY,
      variables: { slug },
    }),
  });

  if (!response.ok) {
    throw new Error(`animethemes.moe request failed with status ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<{ artist: RawArtistThemes | null }>;

  if (!body.data) {
    throw new Error("animethemes.moe response missing data");
  }

  const artist = body.data.artist;
  if (!artist) {
    return null;
  }

  const entries: ArtistThemeEntry[] = [];

  for (const performance of artist.performances) {
    for (const theme of performance.song.animethemes) {
      const aniListId = theme.anime.resources.nodes[0]?.externalId;
      if (aniListId === null || aniListId === undefined) {
        continue;
      }

      const video = theme.animethemeentries[0]?.videos.nodes[0] ?? null;

      entries.push({
        animethemesThemeId: theme.id,
        themeSlot: theme.slug,
        songTitle: performance.song.title.romaji,
        songTitleNative: performance.song.title.native,
        animeAniListId: aniListId,
        animeAnimethemesId: theme.anime.id,
        animeTitleRomaji: theme.anime.title.romaji,
        videoUrl: video?.link ?? null,
        audioUrl: video?.audio?.link ?? null,
      });
    }
  }

  return { artistName: artist.name.main, entries };
}

export async function fetchAnimeThemesByAniListId(aniListId: number): Promise<AnimeThemesResult | null> {
  const response = await fetch(ANIMETHEMES_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": USER_AGENT },
    body: JSON.stringify({
      query: FIND_BY_ANILIST_QUERY,
      variables: { anilistId: [aniListId] },
    }),
  });

  if (!response.ok) {
    throw new Error(`animethemes.moe request failed with status ${response.status}`);
  }

  const body = (await response.json()) as GraphQLResponse<{ findAnimeByExternalSite: RawAnime[] }>;

  if (!body.data) {
    throw new Error("animethemes.moe response missing data");
  }

  const match = body.data.findAnimeByExternalSite[0];
  if (!match) {
    return null;
  }

  const themes = match.animethemes
    .map(toThemeLookup)
    .filter((theme): theme is AnimeThemeLookup => theme !== null);

  return { animethemesId: match.id, themes };
}
