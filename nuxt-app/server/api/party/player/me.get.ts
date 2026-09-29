import { getSessionPlayer } from "../../../utils/partySession.ts";

// The middleware already refuses a phone with no live session.
export default defineEventHandler((event) => {
  const player = getSessionPlayer(event)!;
  return { player: { id: player.id, name: player.name, score: player.score } };
});
