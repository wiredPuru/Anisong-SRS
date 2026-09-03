import {
  getBoxOneStreakRequired,
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
  };
});
