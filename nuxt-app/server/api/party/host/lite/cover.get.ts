import { servePartyCover } from "../../../../utils/partyCover.ts";
import { findLiteSong } from "../../../../utils/partyLiteStore.ts";

// The control door never reaches the SRS cover route, so covers come by token.
export default defineEventHandler((event) => {
  const token = getQuery(event).t;
  return servePartyCover(event, typeof token === "string" ? findLiteSong(token)?.answer.coverImageUrl : null);
});
