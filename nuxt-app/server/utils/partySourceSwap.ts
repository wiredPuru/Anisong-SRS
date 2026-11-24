import { fetchAnimeFromAniList } from "../lib/anilist.ts";
import { fetchAnimeThemesByAniListId } from "../lib/animethemes.ts";
import { fetchThemesByMalId } from "../lib/anisongdb.ts";
import { clipProvider, type PartyClip, type PartyClipProvider } from "./partyGame.ts";
import { titleKey } from "./textMatch.ts";

interface ThemeClips {
  songTitle: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}

/**
 * The other provider's clip for a song, matched on its title only: the two
 * providers number OP/ED slots differently (feature 60a), so a slot match could
 * play a different song. Keeps the current kind when it can.
 */
export function matchAlternateClip(themes: ThemeClips[], songTitle: string, preferKind: PartyClip["kind"], audioOnly: boolean): PartyClip | null {
  const key = titleKey(songTitle);
  if (!key) return null;
  const video = (theme: ThemeClips) => (!audioOnly && theme.videoUrl ? theme.videoUrl : null);
  for (const theme of themes) {
    if (titleKey(theme.songTitle) !== key) continue;
    const videoUrl = video(theme);
    if (preferKind === "video" && videoUrl) return { kind: "video", source: { type: "remote", url: videoUrl } };
    if (theme.audioUrl) return { kind: "audio", source: { type: "remote", url: theme.audioUrl } };
    if (videoUrl) return { kind: "video", source: { type: "remote", url: videoUrl } };
  }
  return null;
}

/** A local or AnisongDB clip switches to AnimeThemes, an AnimeThemes one to AnisongDB. */
export function swapTarget(current: PartyClip): Exclude<PartyClipProvider, "local"> {
  return clipProvider(current) === "animethemes" ? "anisongdb" : "animethemes";
}

/** Looks the song up at the other provider; null when it has no matching clip. */
export async function findAlternateClip(options: {
  aniListId: number;
  songTitle: string;
  current: PartyClip;
  audioOnly: boolean;
}): Promise<PartyClip | null> {
  const { aniListId, songTitle, current, audioOnly } = options;
  if (swapTarget(current) === "animethemes") {
    const result = await fetchAnimeThemesByAniListId(aniListId);
    return matchAlternateClip(result?.themes ?? [], songTitle, current.kind, audioOnly);
  }
  const anime = await fetchAnimeFromAniList(aniListId);
  if (!anime?.malId) return null;
  const themes = await fetchThemesByMalId(anime.malId, aniListId, { includeInserts: true });
  return matchAlternateClip(themes, songTitle, current.kind, audioOnly);
}
