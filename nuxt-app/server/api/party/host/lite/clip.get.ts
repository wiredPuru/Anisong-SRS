import { serveClipSource } from "../../../../utils/partyClip.ts";
import { findLiteSong } from "../../../../utils/partyLiteStore.ts";

// The host's muted preview of the song on screen.
export default defineEventHandler((event) => {
  const token = getQuery(event).t;
  return serveClipSource(event, typeof token === "string" ? findLiteSong(token)?.clip.source ?? null : null);
});
