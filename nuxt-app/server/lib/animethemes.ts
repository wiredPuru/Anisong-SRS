import { isRecord, postGraphQL, ProviderUnavailableError } from "./graphql.ts";

const ANIMETHEMES_ENDPOINT = "https://graphql.animethemes.moe";

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

async function requestAnimeThemes<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  return await postGraphQL(ANIMETHEMES_ENDPOINT, "AnimeThemes", query, variables) as T;
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

export interface AnimeThemeTitles {
  animethemesId: number;
  themes: { animethemesThemeId: number; songTitle: string }[];
}

// Just enough of each anime to say which songs AnimeThemes has: no artists and
// no video links, which is what lets one request cover dozens of anime in about
// the time a single full lookup takes.
const TITLES_BY_ANILIST_QUERY = `
  query ($anilistId: [Int!]) {
    findAnimeByExternalSite(site: ANILIST, id: $anilistId) {
      id
      resources(site: ANILIST) { nodes { externalId } }
      animethemes(first: 50) {
        id
        song { title { romaji native } }
      }
    }
  }
`;

// An id AnimeThemes has no entry for is simply absent from the result.
export async function fetchThemeTitlesByAniListIds(aniListIds: number[]): Promise<Map<number, AnimeThemeTitles>> {
  const wanted = new Set(aniListIds);
  const data = await requestAnimeThemes<{ findAnimeByExternalSite: unknown }>(TITLES_BY_ANILIST_QUERY, { anilistId: aniListIds });
  if (!Array.isArray(data.findAnimeByExternalSite)) throw new ProviderUnavailableError("AnimeThemes");

  const found = new Map<number, AnimeThemeTitles>();
  for (const record of data.findAnimeByExternalSite) {
    if (!isRecord(record) || !isPositiveId(record.id) || !isRecord(record.resources) ||
      !Array.isArray(record.resources.nodes) || !Array.isArray(record.animethemes)) continue;

    const themes = (record.animethemes as RawAnimeTheme[]).flatMap((theme) => {
      const songTitle = theme.song?.title.romaji ?? theme.song?.title.native ?? null;
      return songTitle ? [{ animethemesThemeId: theme.id, songTitle }] : [];
    });

    for (const node of record.resources.nodes) {
      const externalId = isRecord(node) ? node.externalId : undefined;
      if (isPositiveId(externalId) && wanted.has(externalId)) found.set(externalId, { animethemesId: record.id, themes });
    }
  }
  return found;
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
  const data = await requestAnimeThemes<{ artistPagination: { data: RawArtistCandidate[] } }>(ARTIST_SEARCH_QUERY, { search: query, first: 10 });

  return data.artistPagination.data.map((artist) => ({
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
  const data = await requestAnimeThemes<{ artist: RawArtistThemes | null }>(ARTIST_THEMES_QUERY, { slug });

  const artist = data.artist;
  if (artist === null) return null;
  if (!artist || !Array.isArray(artist.performances)) throw new ProviderUnavailableError("AnimeThemes");

  const entries: ArtistThemeEntry[] = [];

  for (const performance of artist.performances) {
    for (const theme of performance.song.animethemes) {
      const aniListId = theme.anime.resources.nodes[0]?.externalId;
      if (!isPositiveId(aniListId)) {
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

export interface SongSearchEntry {
  // Stable row identity for the client, provider-prefixed because a result can
  // come from either provider and only AnimeThemes has a theme id.
  resultKey: string;
  animethemesThemeId: number | null;
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  animeAniListId: number;
  animeAnimethemesId: number | null;
  animeTitleRomaji: string;
  videoUrl: string | null;
  audioUrl: string | null;
}

interface RawSongSearchSong {
  title: RawSongTitle;
  performances: RawPerformance[];
  animethemes: RawArtistThemesTheme[];
}

const SONG_SEARCH_QUERY = `
  query ($search: String!, $first: Int) {
    search(search: $search, first: $first) {
      songs {
        title { romaji native }
        performances {
          artist { name { main native } }
        }
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
`;

export async function searchSongsOnAnimeThemes(query: string): Promise<SongSearchEntry[]> {
  const data = await requestAnimeThemes<{ search: { songs: RawSongSearchSong[] } }>(SONG_SEARCH_QUERY, { search: query, first: 10 });

  const entries: SongSearchEntry[] = [];

  for (const songResult of data.search.songs) {
    const artistName = songResult.performances[0]?.artist.name.main ?? null;

    for (const theme of songResult.animethemes) {
      const aniListId = theme.anime.resources.nodes[0]?.externalId;
      if (!isPositiveId(aniListId)) {
        continue;
      }

      const video = theme.animethemeentries[0]?.videos.nodes[0] ?? null;

      entries.push({
        resultKey: `at:${theme.id}`,
        animethemesThemeId: theme.id,
        themeSlot: theme.slug,
        songTitle: songResult.title.romaji,
        songTitleNative: songResult.title.native,
        artistName,
        animeAniListId: aniListId,
        animeAnimethemesId: theme.anime.id,
        animeTitleRomaji: theme.anime.title.romaji,
        videoUrl: video?.link ?? null,
        audioUrl: video?.audio?.link ?? null,
      });
    }
  }

  return entries;
}

export async function fetchAnimeThemesByAniListId(aniListId: number): Promise<AnimeThemesResult | null> {
  const data = await requestAnimeThemes<{ findAnimeByExternalSite: RawAnime[] }>(FIND_BY_ANILIST_QUERY, { anilistId: [aniListId] });

  if (!Array.isArray(data.findAnimeByExternalSite)) throw new ProviderUnavailableError("AnimeThemes");
  const match = data.findAnimeByExternalSite[0];
  if (!match) {
    return null;
  }

  const themes = match.animethemes
    .map(toThemeLookup)
    .filter((theme): theme is AnimeThemeLookup => theme !== null);

  return { animethemesId: match.id, themes };
}

export interface AnimeThemesMetadata {
  aniListId: number;
  animethemesId: number;
  titleRomaji: string;
  titleEnglish: string | null;
  titleNative: string | null;
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

const METADATA_FIELDS = `
  id
  title { romaji english native }
  resources(site: ANILIST, first: 1) { nodes { externalId } }
`;

function mapMetadata(value: unknown): AnimeThemesMetadata | null {
  if (!isRecord(value) || !isPositiveId(value.id) || !isRecord(value.title) ||
    !isRecord(value.resources) || !Array.isArray(value.resources.nodes)) return null;
  const ids = value.resources.nodes.map((node: unknown) => isRecord(node) ? node.externalId : undefined);
  if (!ids.length || !ids.every(isPositiveId) || new Set(ids).size !== 1) return null;
  const title = value.title;
  const romaji = [title.romaji, title.english, title.native].find((text) => typeof text === "string" && text.trim());
  if (typeof romaji !== "string") return null;
  return {
    aniListId: ids[0]!,
    animethemesId: value.id,
    titleRomaji: romaji,
    titleEnglish: typeof title.english === "string" && title.english.trim() ? title.english : null,
    titleNative: typeof title.native === "string" && title.native.trim() ? title.native : null,
  };
}

function distinctMetadata(records: unknown[]): AnimeThemesMetadata[] {
  const mapped = records.map(mapMetadata).filter((anime): anime is AnimeThemesMetadata => anime !== null);
  const conflicts = new Set(mapped.filter((anime) => mapped.some((other) =>
    other.aniListId === anime.aniListId && other.animethemesId !== anime.animethemesId)).map((anime) => anime.aniListId));
  return [...new Map(mapped.filter((anime) => !conflicts.has(anime.aniListId)).map((anime) => [anime.aniListId, anime])).values()];
}

export async function searchAnimeOnAnimeThemes(search: string): Promise<AnimeThemesMetadata[]> {
  const data = await requestAnimeThemes<Record<string, unknown>>(`
    query ($search: String, $first: Int) {
      animePagination(search: $search, first: $first) { data { ${METADATA_FIELDS} } }
    }
  `, { search, first: 10 });
  if (!isRecord(data.animePagination) || !Array.isArray(data.animePagination.data)) throw new ProviderUnavailableError("AnimeThemes");
  return distinctMetadata(data.animePagination.data).slice(0, 10);
}

export async function fetchAnimeMetadataFromAnimeThemes(id: number, site: "ANILIST" | "MAL"): Promise<AnimeThemesMetadata | null> {
  const data = await requestAnimeThemes<Record<string, unknown>>(`
    query ($id: [Int!]) {
      findAnimeByExternalSite(site: ${site}, id: $id) { ${METADATA_FIELDS} }
    }
  `, { id: [id] });
  const records = data.findAnimeByExternalSite;
  if (!Array.isArray(records)) throw new ProviderUnavailableError("AnimeThemes");
  if (!records.length) return null;
  const mapped = records.map(mapMetadata);
  if (mapped.some((anime) => anime === null)) return null;
  const distinct = distinctMetadata(records);
  if (distinct.length !== 1 || (site === "ANILIST" && distinct[0]!.aniListId !== id)) {
    throw new ProviderUnavailableError("AnimeThemes");
  }
  return distinct[0]!;
}
