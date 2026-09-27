import { listPartyCardIds, parsePartySource, pickPartyQueue } from "../../../utils/partySources.ts";

export default defineEventHandler(async (event) => {
  const source = parsePartySource(await readBody(event).catch(() => null));
  if ("error" in source) {
    throw createError({ statusCode: 400, statusMessage: source.error });
  }
  return pickPartyQueue(listPartyCardIds(source.scope, source.filters, source.downloadedOnly), source.shuffle);
});
