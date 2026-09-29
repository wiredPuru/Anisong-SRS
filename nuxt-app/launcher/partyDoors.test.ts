import { describe, expect, it } from "vitest";
import { decideDoorRequest, lanAddresses } from "./partyDoors.ts";

describe("decideDoorRequest", () => {
  it("sends each door's root to its own page", () => {
    expect(decideDoorRequest("display", "/")).toEqual({ kind: "redirect", location: "/party/display" });
    expect(decideDoorRequest("control", "/")).toEqual({ kind: "redirect", location: "/party/host" });
    expect(decideDoorRequest("player", "/")).toEqual({ kind: "redirect", location: "/party/play" });
  });

  it("lets both doors load the app's shared assets", () => {
    for (const door of ["display", "control", "player"] as const) {
      for (const path of ["/_nuxt/entry.abc.js", "/_nuxt/builds/meta/x.json", "/mascot/kai-wave.webp", "/favicon.ico"]) {
        expect(decideDoorRequest(door, path)).toEqual({ kind: "proxy" });
      }
    }
  });

  it("limits the display door to the display page and display API", () => {
    expect(decideDoorRequest("display", "/party/display")).toEqual({ kind: "proxy" });
    expect(decideDoorRequest("display", "/api/party/display/stream")).toEqual({ kind: "proxy" });
    for (const path of ["/party/host", "/api/party/status", "/api/party/login", "/cards", "/api/cards", "/settings"]) {
      expect(decideDoorRequest("display", path)).toEqual({ kind: "notFound" });
    }
  });

  it("limits the control door to the host page and party API", () => {
    for (const path of ["/party/host", "/api/party/status", "/api/party/login", "/api/party/host/ping"]) {
      expect(decideDoorRequest("control", path)).toEqual({ kind: "proxy" });
    }
    for (const path of ["/party/display", "/api/party/display/stream", "/cards", "/api/cards", "/api/media", "/api/update/restart"]) {
      expect(decideDoorRequest("control", path)).toEqual({ kind: "notFound" });
    }
  });

  it("keeps the player page and player API off the display and control doors", () => {
    for (const door of ["display", "control"] as const) {
      for (const path of ["/party/play", "/api/party/player/join", "/api/party/player/stream"]) {
        expect(decideDoorRequest(door, path)).toEqual({ kind: "notFound" });
      }
    }
  });

  it("limits the player door to the player page and player API", () => {
    for (const path of ["/party/play", "/api/party/player/join", "/api/party/player/stream"]) {
      expect(decideDoorRequest("player", path)).toEqual({ kind: "proxy" });
    }
    for (const path of [
      "/party/host",
      "/party/display",
      "/api/party/status",
      "/api/party/login",
      "/api/party/password",
      "/api/party/host/command",
      "/api/party/display/clip",
      "/cards",
      "/api/cards",
      "/api/update/restart",
    ]) {
      expect(decideDoorRequest("player", path)).toEqual({ kind: "notFound" });
    }
  });
});

describe("lanAddresses", () => {
  it("keeps external IPv4 addresses only, once each", () => {
    expect(
      lanAddresses({
        lo0: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
        en0: [
          { address: "fe80::1", family: "IPv6", internal: false },
          { address: "192.168.1.20", family: "IPv4", internal: false },
        ],
        en1: [{ address: "10.0.0.4", family: 4, internal: false }],
        dup: [{ address: "192.168.1.20", family: "IPv4", internal: false }],
        none: undefined,
      }),
    ).toEqual(["192.168.1.20", "10.0.0.4"]);
  });
});
