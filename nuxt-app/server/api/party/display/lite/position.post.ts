import { parseLitePosition } from "../../../../utils/partyLiteGame.ts";
import { reportLitePosition } from "../../../../utils/partyLiteStore.ts";

export default defineEventHandler(async (event) => {
  const position = parseLitePosition(await readBody(event).catch(() => null));
  if (!position) {
    throw createError({ statusCode: 400, statusMessage: "Invalid position report" });
  }
  return { accepted: reportLitePosition(position) };
});
