import { reportPartyPosition } from "../../../utils/partyStore.ts";
import { parsePartyPosition } from "../../../utils/partyPosition.ts";

export default defineEventHandler(async (event) => {
  const position = parsePartyPosition(await readBody(event).catch(() => null));
  if (!position) {
    throw createError({ statusCode: 400, statusMessage: "Invalid position report" });
  }
  return { accepted: reportPartyPosition(position) };
});
