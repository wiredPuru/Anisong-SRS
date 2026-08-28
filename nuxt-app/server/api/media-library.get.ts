import { getDefaultDownloadFolder, getLibraryPaths } from "../utils/mediaLibrary.ts";

export default defineEventHandler(() => {
  return { libraryPaths: getLibraryPaths(), defaultDownloadFolder: getDefaultDownloadFolder() };
});
