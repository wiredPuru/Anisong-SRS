import { fetchAnimeThemesByAniListId, fetchThemeTitlesByAniListIds } from "../lib/animethemes.ts";
import { fetchThemesByMalId, type AnisongTheme } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { titleKey } from "./textMatch.ts";
import { isInsertSlot } from "./themeSlot.ts";

export interface ResolvedTheme {
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  animethemesThemeId: number | null;
  animethemesVideoSlug: string | null;
  source: "anisongdb" | "animethemes" | "merged";
}

export interface ResolvedThemes {
  animethemesId: number | null;
  animethemesSlug: string | null;
  animethemesUnavailable: boolean;
  themes: ResolvedTheme[];
}

export type AnimeThemesMatchIndex =
  | {
      status: "ok";
      animethemesId: number | null;
      animethemesSlug: string | null;
      byTitle: Map<string, number>;
      videoSlugByThemeId: Map<number, string>;
    }
  | { status: "unavailable" };

interface MatchIndexSource {
  animethemesId: number;
  animethemesSlug: string | null;
  themes: { animethemesThemeId: number; songTitle: string | null; animethemesVideoSlug: string | null }[];
}

// Titles are the identity here for the same reason resolveThemes pairs on them:
// the providers do not agree on slot numbering.
function buildMatchIndex(source: MatchIndexSource | null): AnimeThemesMatchIndex {
  const byTitle = new Map<string, number>();
  const videoSlugByThemeId = new Map<number, string>();
  for (const theme of source?.themes ?? []) {
    const key = titleKey(theme.songTitle);
    if (key && !byTitle.has(key)) byTitle.set(key, theme.animethemesThemeId);
    if (theme.animethemesVideoSlug) videoSlugByThemeId.set(theme.animethemesThemeId, theme.animethemesVideoSlug);
  }
  return {
    status: "ok",
    animethemesId: source?.animethemesId ?? null,
    animethemesSlug: source?.animethemesSlug ?? null,
    byTitle,
    videoSlugByThemeId,
  };
}

// One AnimeThemes request per anime, then any number of songs can be checked
// against it.
export async function loadAnimeThemesMatchIndex(aniListId: number): Promise<AnimeThemesMatchIndex> {
  try {
    return buildMatchIndex(await fetchAnimeThemesByAniListId(aniListId));
  } catch (error) {
    if (error instanceof ProviderUnavailableError) return { status: "unavailable" };
    throw error;
  }
}

// null is an outage, so the caller can retry it or give up on the whole chunk.
async function loadMatchIndexChunk(aniListIds: number[]): Promise<Map<number, AnimeThemesMatchIndex> | null> {
  try {
    const found = await fetchThemeTitlesByAniListIds(aniListIds);
    return new Map(aniListIds.map((id) => {
      return [id, buildMatchIndex(found.get(id) ?? null)];
    }));
  } catch (error) {
    if (error instanceof ProviderUnavailableError) return null;
    throw error;
  }
}

// Starts the lookups for a whole catalog at once and hands back one promise per
// id, so a caller working through it finds each answer waiting rather than
// paying a round trip per anime: a request per anime measured about 20s for 70
// anime, a request per chunk about 2s each. An outage is retried once, because
// AnimeThemes answers a burst with 429 and an unretried one would silently read
// as "no match" and let the gate fail open in exactly the large imports it
// matters for. A run of chunks that stay unavailable after the retry means the
// provider is down, not busy, so the rest are answered as unavailable without
// waiting out a timeout each.
export function startMatchIndexLoads(
  aniListIds: number[],
  { chunkSize = 40, concurrency = 2, retryDelayMs = 1000, giveUpAfter = 2 }:
    { chunkSize?: number; concurrency?: number; retryDelayMs?: number; giveUpAfter?: number } = {},
): Map<number, Promise<AnimeThemesMatchIndex>> {
  const ids = [...new Set(aniListIds)];
  const chunks: number[][] = [];
  for (let i = 0; i < ids.length; i += chunkSize) chunks.push(ids.slice(i, i + chunkSize));

  const settlers = new Map<number, { resolve: (index: AnimeThemesMatchIndex) => void; reject: (reason: unknown) => void }>();
  const loads = new Map<number, Promise<AnimeThemesMatchIndex>>();
  for (const id of ids) {
    const load = new Promise<AnimeThemesMatchIndex>((resolve, reject) => settlers.set(id, { resolve, reject }));
    // The import may skip an anime and never await its load; that must not
    // surface as an unhandled rejection.
    load.catch(() => {});
    loads.set(id, load);
  }

  let next = 0;
  let consecutiveOutages = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const chunk = chunks[next++]!;
      try {
        let indexes: Map<number, AnimeThemesMatchIndex> | null = null;
        if (consecutiveOutages < giveUpAfter) {
          indexes = await loadMatchIndexChunk(chunk);
          if (!indexes) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            indexes = await loadMatchIndexChunk(chunk);
          }
          consecutiveOutages = indexes ? 0 : consecutiveOutages + 1;
        }
        for (const id of chunk) settlers.get(id)!.resolve(indexes?.get(id) ?? { status: "unavailable" });
      } catch (error) {
        for (const id of chunk) settlers.get(id)!.reject(error);
      }
    }
  };
  for (let i = 0; i < Math.min(concurrency, chunks.length); i += 1) void worker();
  return loads;
}

// AnimeThemes has no insert songs, so an insert sharing a title with an OP/ED
// (a song used as both) must not take that theme's id and links.
export function findThemeMatch(index: AnimeThemesMatchIndex, songTitle: string | null, themeSlot: string): number | null {
  if (index.status !== "ok" || isInsertSlot(themeSlot)) return null;
  const key = titleKey(songTitle);
  return key ? index.byTitle.get(key) ?? null : null;
}

// What to link a matched song to. An anime slug is useful on its own (the show
// page), so it comes back even when the song has no match.
export function matchLinkSlugs(
  index: AnimeThemesMatchIndex,
  themeId: number | null,
): { animethemesSlug: string | null; animethemesVideoSlug: string | null } {
  if (index.status !== "ok") return { animethemesSlug: null, animethemesVideoSlug: null };
  return {
    animethemesSlug: index.animethemesSlug,
    animethemesVideoSlug: themeId === null ? null : index.videoSlugByThemeId.get(themeId) ?? null,
  };
}

// Fails open: with AnimeThemes unreachable there is no telling "no match" from
// "could not check", and refusing every add during an outage is worse than
// admitting a few cards the /cards filter can clean up later.
export function isMissingAnimeThemesMatch({ storedThemeId, unavailable }: { storedThemeId: number | null; unavailable: boolean }): boolean {
  return storedThemeId === null && !unavailable;
}

// A provider being down degrades the import to the other one; anything else
// (a rejected query, a shape change) is a real fault and must not be hidden
// behind a half-empty theme list.
function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  if (result.status === "fulfilled") return result.value;
  if (result.reason instanceof ProviderUnavailableError) return null;
  throw result.reason;
}

export async function resolveThemes({ aniListId, malId, includeInserts = false }: {
  aniListId: number;
  malId: number | null;
  includeInserts?: boolean;
}): Promise<ResolvedThemes> {
  const [animethemesResult, anisongResult] = await Promise.allSettled([
    fetchAnimeThemesByAniListId(aniListId),
    // AnisongDB is keyed on MAL ids. Without one there is nothing to ask it.
    malId === null ? Promise.resolve([]) : fetchThemesByMalId(malId, aniListId, { includeInserts }),
  ]);

  if (animethemesResult.status === "rejected" && anisongResult.status === "rejected") {
    throw animethemesResult.reason;
  }

  const animethemes = settledValue(animethemesResult);
  const anisong = settledValue(anisongResult) ?? [];

  const bySlot = new Map<string, ResolvedTheme>();

  for (const theme of animethemes?.themes ?? []) {
    bySlot.set(theme.themeSlot, { ...theme, source: "animethemes" });
  }

  // The two providers do not agree on slot numbering: BanG Dream! Ave Mujica's
  // ED1 on AnimeThemes is AnisongDB's Ending 2, and vice versa. Pairing by slot
  // would have put one song's title on another song's audio, so the song title
  // is the identity here and the slot is only a label.
  // Inserts sit out the pairing: AnimeThemes has none, so a title match could
  // only be an OP/ED that reuses the song, and pairing would swap its clip.
  const inserts = anisong.filter((theme) => isInsertSlot(theme.themeSlot));
  const unpaired = new Map<string, AnisongTheme[]>();
  for (const theme of anisong) {
    if (isInsertSlot(theme.themeSlot)) continue;
    const key = titleKey(theme.songTitle);
    if (key) unpaired.set(key, [...unpaired.get(key) ?? [], theme]);
  }

  for (const [slot, known] of bySlot) {
    const match = unpaired.get(titleKey(known.songTitle) ?? "")?.shift();
    if (!match) continue;
    // AnimeThemes keeps the metadata (it is the only source of a native song
    // title, and re-importing must not rewrite titles that are already stored),
    // AnisongDB supplies the clip URLs, which is the whole point of preferring
    // it. A kind AnisongDB does not have falls back rather than being lost.
    bySlot.set(slot, {
      ...known,
      videoUrl: match.videoUrl ?? known.videoUrl,
      audioUrl: match.audioUrl ?? known.audioUrl,
      source: "merged",
    });
  }

  for (const leftovers of [...unpaired.values(), inserts]) {
    for (const theme of leftovers) {
      // Its slot number is only trustworthy where AnimeThemes has claimed
      // nothing; otherwise this is a song AnimeThemes labels differently and
      // adding it would overwrite a theme that is already correct.
      if (bySlot.has(theme.themeSlot)) continue;
      bySlot.set(theme.themeSlot, {
        ...theme,
        songTitleNative: null,
        animethemesThemeId: null,
        animethemesVideoSlug: null,
        source: "anisongdb",
      });
    }
  }

  return {
    animethemesId: animethemes?.animethemesId ?? null,
    animethemesSlug: animethemes?.animethemesSlug ?? null,
    // settledValue rethrows anything but an outage, so a rejection here is one.
    animethemesUnavailable: animethemesResult.status === "rejected",
    themes: [...bySlot.values()],
  };
}
