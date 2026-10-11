import { partyPlayers } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  if (typeof body?.ip !== "string" || !body.ip.trim()) {
    throw createError({ statusCode: 400, statusMessage: "ip must be an address" });
  }
  if (!partyPlayers.unban(body.ip)) {
    throw createError({ statusCode: 404, statusMessage: "That address is not banned" });
  }
  return { ok: true };
});
