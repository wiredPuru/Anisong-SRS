import { listCards } from "../utils/cards.ts";

export default defineEventHandler(() => {
  return { cards: listCards() };
});
