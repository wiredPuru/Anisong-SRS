import { getCardsByIds } from "../../utils/cards.ts";
import { orderCardsByIds } from "../../utils/listenQueue.ts";
import { listPartyCardIds, parsePartySource, pickPartyQueue } from "../../utils/partySources.ts";

export default defineEventHandler(async (event) => {
  const source = parsePartySource(await readBody(event).catch(() => null));
  if ("error" in source) {
    throw createError({ statusCode: 400, statusMessage: source.error });
  }
  const { cardIds, total } = pickPartyQueue(listPartyCardIds(source.scope, source.filters), source.shuffle);
  return { cards: orderCardsByIds(cardIds, getCardsByIds(cardIds)), total };
});
