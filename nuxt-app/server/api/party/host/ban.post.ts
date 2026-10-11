import { partyPlayers } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const id = body?.id;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 1) {
    throw createError({ statusCode: 400, statusMessage: "id must be a player id" });
  }
  const result = partyPlayers.ban(id);
  if (!result.ok) {
    throw createError(
      result.reason === "unknown"
        ? { statusCode: 404, statusMessage: "No such player" }
        : { statusCode: 409, statusMessage: "No address was recorded for that phone" },
    );
  }
  return { ok: true, ip: result.ip, removed: result.removed };
});
