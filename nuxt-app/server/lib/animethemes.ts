const ANIMETHEMES_ENDPOINT = "https://graphql.animethemes.moe";
// animethemes.moe blocks Node's default fetch User-Agent with a bare 403;
// an identifying UA (not a spoofed browser string) passes fine.
const USER_AGENT = "GAQ-SRS/1.0 (personal AMQ study app)";

export interface AnimeThemeLookup {
  animethemesThemeId: number;
  themeSlot: string;
  songTitle: string | null;
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

  const artistName = theme.song?.performances[0]?.artist.name.main ?? null;
  const video = theme.animethemeentries[0]?.videos.nodes[0] ?? null;

  return {
    animethemesThemeId: theme.id,
    themeSlot: theme.slug,
    songTitle,
    artistName,
    videoUrl: video?.link ?? null,
    audioUrl: video?.audio?.link ?? null,
  };
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
