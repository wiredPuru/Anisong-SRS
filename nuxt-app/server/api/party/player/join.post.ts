import { getPlayerToken, setPlayerCookie } from "../../../utils/partySession.ts";
import { partyPlayers } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const result = partyPlayers.join({
    name: body?.name,
    token: getPlayerToken(event),
  });
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message });
  }
  setPlayerCookie(event, result.token);
  const { id, name, score } = result.player;
  return { player: { id, name, score } };
});
