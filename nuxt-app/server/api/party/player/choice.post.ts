import { getSessionPlayer } from "../../../utils/partySession.ts";
import { pickPartyChoice } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const player = getSessionPlayer(event)!;
  const body = (await readBody(event).catch(() => null)) as { index?: unknown } | null;
  if (!Number.isInteger(body?.index)) throw createError({ statusCode: 400, statusMessage: "index must be a whole number" });
  return { accepted: pickPartyChoice(player.id, body!.index as number) };
});
