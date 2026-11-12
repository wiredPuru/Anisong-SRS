import { serveClipSource } from "../../../../utils/partyClip.ts";
import { getLiteState } from "../../../../utils/partyLiteStore.ts";

// The display only ever knows a token, and only the song on screen is served,
// so neither a file name nor a clip URL (both can name the anime) reaches it.
export default defineEventHandler((event) => {
  const current = getLiteState().current;
  return serveClipSource(event, current && getQuery(event).t === current.token ? current.clip.source : null);
});
