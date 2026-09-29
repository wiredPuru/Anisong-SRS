import { getSessionPlayer } from "../../../utils/partySession.ts";
import { buzzParty } from "../../../utils/partyStore.ts";

export default defineEventHandler((event) => {
  const player = getSessionPlayer(event)!;
  return { accepted: buzzParty(player.id) };
});
