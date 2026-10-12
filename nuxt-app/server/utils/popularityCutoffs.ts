import { requestAniList } from "../lib/anilist.ts";
import { DEFAULT_CUTOFFS, type PopularityCutoffs } from "./partyEndless.ts";
import { createTimedCache } from "./timedCache.ts";
import { getOfflineMode } from "./mediaLibrary.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const QUERY = `
  query ($page: Int) {
    Page(page: $page, perPage: 1) {
      media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) { popularity }
    }
  }
`;

function parsePopularity(data: Record<string, unknown> | null): number | null {
  const page = data?.Page as { media?: { popularity?: unknown }[] } | undefined;
  const popularity = page?.media?.[0]?.popularity;
  return typeof popularity === "number" && popularity > 0 ? popularity : null;
}

const loadCutoffs = createTimedCache<PopularityCutoffs>(async () => {
  const [top500, top1000] = await Promise.all([500, 1000].map((page) => requestAniList(QUERY, { page }, parsePopularity)));
  if (top500 === null || top1000 === null) throw new Error("AniList returned no popularity");
  return { top500, top1000 };
}, DAY_MS);

let current: PopularityCutoffs = DEFAULT_CUTOFFS;

/** The last cutoffs AniList reported (or sensible defaults); refreshes in the background. */
export function popularityCutoffs(): PopularityCutoffs {
  if (getOfflineMode()) return current;
  void loadCutoffs().then((fresh) => {
    current = fresh;
  }, () => undefined);
  return current;
}
