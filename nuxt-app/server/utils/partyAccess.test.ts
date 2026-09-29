import { describe, expect, it } from "vitest";
import { parsePartyDoor, partyRouteAccess } from "./partyAccess.ts";

describe("parsePartyDoor", () => {
  it("accepts only the three door names", () => {
    expect(parsePartyDoor("display")).toBe("display");
    expect(parsePartyDoor("control")).toBe("control");
    expect(parsePartyDoor("player")).toBe("player");
    expect(parsePartyDoor("admin")).toBeNull();
    expect(parsePartyDoor(undefined)).toBeNull();
  });
});

describe("partyRouteAccess", () => {
  it("passes every non-party path through untouched", () => {
    expect(partyRouteAccess("/cards", null, false)).toBe("pass");
    expect(partyRouteAccess("/api/cards?q=x", "control", true)).toBe("pass");
    expect(partyRouteAccess("/partying", "control", true)).toBe("pass");
  });

  it("hides party routes outside the party process or without a door", () => {
    expect(partyRouteAccess("/party/host", "control", false)).toBe("notFound");
    expect(partyRouteAccess("/api/party/status", null, true)).toBe("notFound");
  });

  it("serves only the display page and display API on the display door", () => {
    expect(partyRouteAccess("/party/display", "display", true)).toBe("public");
    expect(partyRouteAccess("/api/party/display/stream", "display", true)).toBe("public");
    expect(partyRouteAccess("/party/host", "display", true)).toBe("notFound");
    expect(partyRouteAccess("/api/party/login", "display", true)).toBe("notFound");
    expect(partyRouteAccess("/api/party/host/ping", "display", true)).toBe("notFound");
  });

  it("serves the host page and auth routes publicly on the control door", () => {
    for (const path of ["/party/host", "/party/host/", "/api/party/status", "/api/party/login", "/api/party/logout", "/api/party/password"]) {
      expect(partyRouteAccess(path, "control", true)).toBe("public");
    }
  });

  it("requires a session for host API routes", () => {
    expect(partyRouteAccess("/api/party/host/ping", "control", true)).toBe("session");
    expect(partyRouteAccess("/api/party/host/queue?x=1", "control", true)).toBe("session");
  });

  it("keeps display routes off the control door and unknown party routes hidden", () => {
    expect(partyRouteAccess("/party/display", "control", true)).toBe("notFound");
    expect(partyRouteAccess("/api/party/display/stream", "control", true)).toBe("notFound");
    expect(partyRouteAccess("/api/party/other", "control", true)).toBe("notFound");
  });

  it("keeps the player page and player API off the display and control doors", () => {
    for (const door of ["display", "control"] as const) {
      expect(partyRouteAccess("/party/play", door, true)).toBe("notFound");
      expect(partyRouteAccess("/api/party/player/join", door, true)).toBe("notFound");
      expect(partyRouteAccess("/api/party/player/me", door, true)).toBe("notFound");
    }
  });

  it("serves the join page and join route publicly on the player door and gates the rest", () => {
    expect(partyRouteAccess("/party/play", "player", true)).toBe("public");
    expect(partyRouteAccess("/party/play/", "player", true)).toBe("public");
    expect(partyRouteAccess("/api/party/player/join", "player", true)).toBe("public");
    expect(partyRouteAccess("/api/party/player/me", "player", true)).toBe("player");
    expect(partyRouteAccess("/api/party/player/stream?x=1", "player", true)).toBe("player");
  });

  it("hides every host, display, and auth route on the player door", () => {
    for (const path of ["/party/host", "/party/display", "/api/party/status", "/api/party/login", "/api/party/password", "/api/party/host/command", "/api/party/display/stream"]) {
      expect(partyRouteAccess(path, "player", true)).toBe("notFound");
    }
  });
});
