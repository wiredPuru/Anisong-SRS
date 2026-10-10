import { partyPlayers } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const id = body?.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: "id must be a player id" });
  }
  if (!partyPlayers.kick(id)) {
    throw createError({ statusCode: 404, statusMessage: "No such player" });
  }
  return { ok: true };
});
