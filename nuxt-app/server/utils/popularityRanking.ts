import { requestAniList } from "../lib/anilist.ts";
import { getOfflineMode } from "./mediaLibrary.ts";
import type { RankedAnime } from "./partyCatalogGrid.ts";
import { createTimedCache } from "./timedCache.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const PER_PAGE = 50;
const PAGES = 20;
const QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { id idMal }
    }
  }
`;

/** One page of AniList's popularity ranking; rank counts from the page's first slot. */
export function parseRankingPage(data: Record<string, unknown> | null, page: number, perPage = PER_PAGE): RankedAnime[] {
  const media = (data?.Page as { media?: unknown } | undefined)?.media;
  if (!Array.isArray(media)) return [];
  const ranked: RankedAnime[] = [];
  media.forEach((entry: unknown, i) => {
    const { id, idMal } = (entry ?? {}) as { id?: unknown; idMal?: unknown };
    if (typeof id !== "number") return;
    ranked.push({ aniListId: id, malId: typeof idMal === "number" ? idMal : null, rank: (page - 1) * perPage + i + 1 });
  });
  return ranked;
}

const loadRanking = createTimedCache<RankedAnime[]>(async () => {
  const ranking: RankedAnime[] = [];
  // One after another: AniList's rate limit is about 30 a minute when degraded.
  for (let page = 1; page <= PAGES; page++) {
    const entries = await requestAniList(QUERY, { page, perPage: PER_PAGE }, (data) => parseRankingPage(data, page), false, DAY_MS);
    if (!entries.length) throw new Error(`AniList ranking page ${page} was empty`);
    ranking.push(...entries);
  }
  return ranking;
}, DAY_MS);

let latest: RankedAnime[] | null = null;
let loading: Promise<RankedAnime[] | null> | null = null;

/** AniList's 1000 most popular anime, or null offline or when AniList fails. Never throws. */
export function loadPopularityRanking(): Promise<RankedAnime[] | null> {
  if (getOfflineMode()) return Promise.resolve(null);
  loading ??= loadRanking()
    .then((ranking) => (latest = ranking), () => null)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/**
 * The ranking, waiting at most `ms` for a load in progress. From the response
 * cache that is near instant; a fresh load from AniList usually takes longer.
 */
export async function rankingWithin(ms: number): Promise<RankedAnime[] | null> {
  if (latest) return currentRanking();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([loadPopularityRanking(), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** The ranking if it has loaded (starting a load or refresh without waiting), else null. */
export function currentRanking(): RankedAnime[] | null {
  void loadPopularityRanking();
  return latest;
}
