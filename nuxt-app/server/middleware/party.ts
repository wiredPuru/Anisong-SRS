import { isBannedPlayerRequest, partyRouteAccess } from "../utils/partyAccess.ts";
import { getPartyClientIp, getPartyDoor, hasPartySession, hasPlayerSession, isPartyEnabled } from "../utils/partySession.ts";
import { partyPlayers } from "../utils/partyStore.ts";

export default defineEventHandler((event) => {
  const door = getPartyDoor(event);
  const access = partyRouteAccess(event.path, door, isPartyEnabled());
  if (access === "notFound") {
    throw createError({ statusCode: 404, statusMessage: "Not Found" });
  }
  if (isBannedPlayerRequest(event.path, door, partyPlayers.isBanned(getPartyClientIp(event)))) {
    throw createError({ statusCode: 403, statusMessage: "You can't join this game." });
  }
  if (access === "session" && !hasPartySession(event)) {
    throw createError({ statusCode: 401, statusMessage: "Host login required" });
  }
  if (access === "player" && !hasPlayerSession(event)) {
    throw createError({ statusCode: 401, statusMessage: "Join the game first" });
  }
});
