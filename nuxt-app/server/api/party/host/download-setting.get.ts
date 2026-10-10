import { getDefaultDownloadFolder, getPartyAutoDownload } from "../../../utils/mediaLibrary.ts";

export default defineEventHandler(() => ({
  partyAutoDownload: getPartyAutoDownload(),
  hasDownloadFolder: getDefaultDownloadFolder() !== null,
}));
