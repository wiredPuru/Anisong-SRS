import { searchSongsOnAnimeThemes, type SongSearchEntry } from "../lib/animethemes.ts";
import { searchSongs, type ThemeOptions } from "../lib/anisongdb.ts";
import { ProviderUnavailableError } from "../lib/graphql.ts";
import { filterClipUrls } from "./clipSource.ts";
import { getClipSource } from "./mediaLibrary.ts";

export interface FilteredSongSearchEntry extends SongSearchEntry {
  clipBlocked: boolean;
}

// AnisongDB answers a song search in roughly a third of the time AnimeThemes
// takes, and its clip URLs come from AMQ's own hosts, so it is asked first.
// Unlike the per-anime import (see themeSource.ts) there is nothing to merge:
// a search result is a picking aid, and the import that follows re-resolves
// everything from the AniList id anyway.
export async function searchSongEntries(query: string, options: ThemeOptions = {}): Promise<FilteredSongSearchEntry[]> {
  let entries: SongSearchEntry[];
  try {
    entries = (await searchSongs(query, options)).map((result) => ({
      resultKey: `adb:${result.annSongId}`,
      animethemesThemeId: null,
      themeSlot: result.themeSlot,
      songTitle: result.songTitle,
      // AnisongDB carries no native song title. The import stores null, which
      // upsertSong treats as "leave any stored value alone".
      songTitleNative: null,
      artistName: result.artistName,
      animeAniListId: result.animeAniListId,
      animeAnimethemesId: null,
      animeTitleRomaji: result.animeTitleRomaji,
      videoUrl: result.videoUrl,
      audioUrl: result.audioUrl,
    }));
  } catch (error) {
    // Only an outage falls back. A rejected request means the app sent
    // something wrong, and masking that behind a second provider would hide a
    // real fault.
    if (!(error instanceof ProviderUnavailableError)) throw error;
    entries = await searchSongsOnAnimeThemes(query);
  }

  const clipSource = getClipSource();
  return entries.map((entry) => {
    const { videoUrl, audioUrl, clipBlocked } = filterClipUrls(entry.videoUrl, entry.audioUrl, clipSource);
    return { ...entry, videoUrl, audioUrl, clipBlocked };
  });
}
