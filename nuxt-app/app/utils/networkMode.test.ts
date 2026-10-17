import { describe, expect, it } from "vitest";
import { isOfflineModeError, networkModeChanged, networkModeEndpoint, parseNetworkMode } from "./networkMode.ts";

describe("browser network bootstrap", () => {
  it.each([
    ["/settings", "/api/network-mode"], ["/", "/api/network-mode"],
    ["/party/display", "/api/party/display/network-mode"],
    ["/party/host", "/api/party/host/network-mode"], ["/party/play", "/api/party/player/network-mode"],
  ])("uses the scoped status endpoint for %s", (path, endpoint) => {
    expect(networkModeEndpoint(path)).toBe(endpoint);
  });
  it.each([null, undefined, {}, { offlineMode: "false" }, { offlineMode: 0 }, { error: "unauthorized" }])("fails closed for invalid responses: %j", (value) => {
    expect(parseNetworkMode(value)).toBeNull();
  });
  it("accepts only confirmed booleans", () => {
    expect(parseNetworkMode({ offlineMode: true })).toBe(true);
    expect(parseNetworkMode({ offlineMode: false })).toBe(false);
  });
  it("reloads only on a confirmed change, not a failed or first read", () => {
    expect(networkModeChanged(true, false)).toBe(true);
    expect(networkModeChanged(false, true)).toBe(true);
    expect(networkModeChanged(false, false)).toBe(false);
    expect(networkModeChanged(null, false)).toBe(false);
    expect(networkModeChanged(false, null)).toBe(false);
  });
});

describe("isOfflineModeError", () => {
  it("reads the code from an H3 error", () => {
    expect(isOfflineModeError({ statusCode: 409, data: { code: "OFFLINE_MODE" } })).toBe(true);
  });
  it("reads the code from a $fetch error's nested body", () => {
    expect(isOfflineModeError({ statusCode: 409, data: { statusCode: 409, data: { code: "OFFLINE_MODE" } } })).toBe(true);
  });
  it.each([
    { statusCode: 409, data: { statusMessage: "Conflict" } },
    { statusCode: 409 },
    new TypeError("Failed to fetch"),
    { data: { code: "OTHER" } },
    null, undefined, "OFFLINE_MODE", 409,
  ])("is false for %j", (value) => {
    expect(isOfflineModeError(value)).toBe(false);
  });
});
