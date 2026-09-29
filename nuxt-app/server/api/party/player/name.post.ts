import { getPlayerToken } from "../../../utils/partySession.ts";
import { partyPlayers } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const result = partyPlayers.rename(getPlayerToken(event), body?.name);
  if (!result.ok) {
    throw createError({ statusCode: result.status, statusMessage: result.message });
  }
  return { name: result.name };
});
