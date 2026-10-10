import { servePartyClip } from "../../../utils/partyClip.ts";

// The display only ever knows a token, so neither a file name nor a clip URL
// (both of which can name the anime) reaches the screen being guessed at.
export default defineEventHandler(servePartyClip);
