import { getLibraryPaths } from "../utils/mediaLibrary.ts";

export default defineEventHandler(() => {
  return { libraryPaths: getLibraryPaths() };
});
