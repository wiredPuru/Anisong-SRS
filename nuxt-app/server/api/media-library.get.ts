import { countAnimeMissingDetails } from "../utils/animeDetailsBackfill.ts";
import { countCardsToRefresh } from "../utils/cardSourceRefresh.ts";
import { countAnimeMissingLinks } from "../utils/animethemesLinkBackfill.ts";
import { countUncheckedSongs } from "../utils/animethemesMatch.ts";
import { countAnimeMissingCover } from "../utils/coverBackfill.ts";
import {
  getAutoDownload,
  getThemesOnly,
  getIncludeInsertSongs,
  getBoxOneStreakRequired,
  getClipSource,
  getDailyNewCardLimit,
  getDefaultDownloadFolder,
  getLibraryPaths,
  getPlaybackMode,
  getStreamCacheMaxBytes,
} from "../utils/mediaLibrary.ts";
import { getStreamCacheDir } from "../utils/streamCache.ts";

export default defineEventHandler(() => {
  return {
    libraryPaths: getLibraryPaths(),
    defaultDownloadFolder: getDefaultDownloadFolder(),
    dailyNewCardLimit: getDailyNewCardLimit(),
    boxOneStreakRequired: getBoxOneStreakRequired(),
    streamCacheMaxBytes: getStreamCacheMaxBytes(),
    streamCachePath: getStreamCacheDir(),
    playbackMode: getPlaybackMode(),
    autoDownload: getAutoDownload(),
    themesOnly: getThemesOnly(),
    includeInsertSongs: getIncludeInsertSongs(),
    clipSource: getClipSource(),
    missingCoverCount: countAnimeMissingCover(),
    missingAnimeDetailsCount: countAnimeMissingDetails(),
    animethemesUncheckedCount: countUncheckedSongs(),
    animethemesMissingLinkCount: countAnimeMissingLinks(),
    animethemesSourcedCardCount: countCardsToRefresh(),
  };
});
