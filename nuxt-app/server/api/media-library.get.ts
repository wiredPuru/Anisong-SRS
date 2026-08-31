import {
  getBoxOneStreakRequired,
  getDailyNewCardLimit,
  getDefaultDownloadFolder,
  getLibraryPaths,
  getPlaybackMode,
  getStreamCacheMaxBytes,
} from "../utils/mediaLibrary.ts";

export default defineEventHandler(() => {
  return {
    libraryPaths: getLibraryPaths(),
    defaultDownloadFolder: getDefaultDownloadFolder(),
    dailyNewCardLimit: getDailyNewCardLimit(),
    boxOneStreakRequired: getBoxOneStreakRequired(),
    streamCacheMaxBytes: getStreamCacheMaxBytes(),
    playbackMode: getPlaybackMode(),
  };
});
