export type PartyDoor = "display" | "control";

export const PARTY_DOOR_HEADER = "x-gaq-party-door";
export const PARTY_CLIENT_IP_HEADER = "x-gaq-party-client-ip";
export const PARTY_SESSION_COOKIE = "gaq_party_session";

const CONTROL_PUBLIC_API = new Set([
  "/api/party/status",
  "/api/party/login",
  "/api/party/logout",
  "/api/party/password",
]);

/**
 * What a request to the app may do under party mode: `pass` for a non-party
 * path, `notFound` when the route must stay hidden, `public` to serve it, and
 * `session` when a host login is required.
 */
export type PartyAccess = "pass" | "notFound" | "public" | "session";

export function parsePartyDoor(value: string | null | undefined): PartyDoor | null {
  return value === "display" || value === "control" ? value : null;
}

export function partyRouteAccess(rawPath: string, door: PartyDoor | null, partyEnabled: boolean): PartyAccess {
  const path = rawPath.split("?")[0]!.replace(/\/+$/, "") || "/";
  const isPage = path === "/party" || path.startsWith("/party/");
  const isApi = path === "/api/party" || path.startsWith("/api/party/");
  if (!isPage && !isApi) return "pass";
  if (!partyEnabled || !door) return "notFound";

  if (door === "display") {
    const allowed = path === "/party/display" || path.startsWith("/api/party/display/");
    return allowed ? "public" : "notFound";
  }

  if (path === "/party/host" || CONTROL_PUBLIC_API.has(path)) return "public";
  if (path.startsWith("/api/party/host/")) return "session";
  return "notFound";
}
