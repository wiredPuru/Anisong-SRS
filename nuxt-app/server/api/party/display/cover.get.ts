import { servePartyCover } from "../../../utils/partyCover.ts";
import { findPartyItemByToken } from "../../../utils/partyStore.ts";

// Cover mode shows the answer's artwork, so, like clips, it reaches the
// display only by token and never as an AniList URL.
export default defineEventHandler((event) => {
  const token = getQuery(event).t;
  const item = typeof token === "string" ? findPartyItemByToken(token) : null;
  return servePartyCover(event, item?.answer.coverImageUrl);
});
