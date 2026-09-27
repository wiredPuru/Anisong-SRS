import { endPartySession } from "../../utils/partySession.ts";

export default defineEventHandler((event) => {
  endPartySession(event);
  return { ok: true };
});
