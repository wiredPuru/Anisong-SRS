import { offlineHiddenCount } from "../../../utils/offlinePlayable.ts";
import { countLibraryCards, listPartyQueueIds, parsePartySource } from "../../../utils/partySources.ts";

export default defineEventHandler(async (event) => {
  const source = parsePartySource(await readBody(event).catch(() => null));
  if ("error" in source) {
    throw createError({ statusCode: 400, statusMessage: source.error });
  }
  return { ...listPartyQueueIds(source.scope, source.filters, source.downloadedOnly, source.shuffle), libraryTotal: countLibraryCards(), offlineHidden: offlineHiddenCount() };
});
