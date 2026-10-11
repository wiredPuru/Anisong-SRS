import { servePartyClip } from "../../../utils/partyClip.ts";

// The host's muted preview, which runs a little ahead of the display.
export default defineEventHandler(servePartyClip);
