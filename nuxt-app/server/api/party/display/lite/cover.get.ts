import { servePartyCover } from "../../../../utils/partyCover.ts";
import { getLiteState } from "../../../../utils/partyLiteStore.ts";

// The cover is the answer, so the display gets it only once the host reveals.
export default defineEventHandler((event) => {
  const { current, revealed } = getLiteState();
  const shown = current && revealed && getQuery(event).t === current.token;
  return servePartyCover(event, shown ? current.answer.coverImageUrl : null);
});
