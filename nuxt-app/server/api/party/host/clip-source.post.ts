import { setClipSource } from "../../../utils/mediaLibrary.ts";
import { partyClipSourceChanged } from "../../../utils/partyStore.ts";

// The same Clip source setting as the main app's Settings > Playback; changing
// it here also switches the songs about to play.
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  if (!body || typeof body.clipSource !== "string") {
    throw createError({ statusCode: 400, statusMessage: "clipSource is required and must be a string" });
  }
  const result = setClipSource(body.clipSource);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }
  partyClipSourceChanged();
  return result;
});
