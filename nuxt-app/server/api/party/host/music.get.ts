import { getLibraryPaths } from "../../../utils/mediaLibrary.ts";
import { listPartyMusic } from "../../../utils/partyMusic.ts";

export default defineEventHandler(() => {
  const { folder, folders, tracks } = listPartyMusic(getLibraryPaths());
  return { folder, folders, tracks };
});
