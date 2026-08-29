import { getDeckMembershipsByCard } from "../../utils/decks.ts";

export default defineEventHandler(() => {
  return { memberships: getDeckMembershipsByCard() };
});
