import { getCardsBySongIds } from "../../utils/cards.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const raw = typeof query.songIds === "string" ? query.songIds : "";
  const songIds = raw
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n));

  return { cards: getCardsBySongIds(songIds) };
});
