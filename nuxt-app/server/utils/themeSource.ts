import { fetchAnimeThemesByAniListId } from "../lib/animethemes.ts";
import { fetchThemesByMalId, type AnisongTheme } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { titleKey } from "./textMatch.ts";

export interface ResolvedTheme {
  themeSlot: string;
  songTitle: string | null;
  songTitleNative: string | null;
  artistName: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
  animethemesThemeId: number | null;
  source: "anisongdb" | "animethemes" | "merged";
}

export interface ResolvedThemes {
  animethemesId: number | null;
  themes: ResolvedTheme[];
}

// A provider being down degrades the import to the other one; anything else
// (a rejected query, a shape change) is a real fault and must not be hidden
// behind a half-empty theme list.
function settledValue<T>(result: PromiseSettledResult<T>): T | null {
  if (result.status === "fulfilled") return result.value;
  if (result.reason instanceof ProviderUnavailableError) return null;
  throw result.reason;
}

export async function resolveThemes({ aniListId, malId }: { aniListId: number; malId: number | null }): Promise<ResolvedThemes> {
  const [animethemesResult, anisongResult] = await Promise.allSettled([
    fetchAnimeThemesByAniListId(aniListId),
    // AnisongDB is keyed on MAL ids. Without one there is nothing to ask it.
    malId === null ? Promise.resolve([]) : fetchThemesByMalId(malId, aniListId),
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
  const unpaired = new Map<string, AnisongTheme[]>();
  for (const theme of anisong) {
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

  for (const leftovers of unpaired.values()) {
    for (const theme of leftovers) {
      // Its slot number is only trustworthy where AnimeThemes has claimed
      // nothing; otherwise this is a song AnimeThemes labels differently and
      // adding it would overwrite a theme that is already correct.
      if (bySlot.has(theme.themeSlot)) continue;
      bySlot.set(theme.themeSlot, { ...theme, songTitleNative: null, animethemesThemeId: null, source: "anisongdb" });
    }
  }

  return { animethemesId: animethemes?.animethemesId ?? null, themes: [...bySlot.values()] };
}
