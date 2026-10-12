import { getOfflineMode } from "../../../utils/mediaLibrary.ts";

export default defineEventHandler((event) => {
  setHeader(event, "cache-control", "no-store");
  return { offlineMode: getOfflineMode() };
});
