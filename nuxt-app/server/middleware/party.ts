import { partyRouteAccess } from "../utils/partyAccess.ts";
import { getPartyDoor, hasPartySession, isPartyEnabled } from "../utils/partySession.ts";

export default defineEventHandler((event) => {
  const access = partyRouteAccess(event.path, getPartyDoor(event), isPartyEnabled());
  if (access === "notFound") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }
  if (access === "session" && !hasPartySession(event)) {
    throw createError({ statusCode: 401, statusMessage: "Host login required" });
  }
});
