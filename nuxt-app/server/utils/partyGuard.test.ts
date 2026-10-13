import { describe, expect, it } from "vitest";
import { DEFAULT_CREDITS_GUARD, DEFAULT_START_FLOOR, clampStartFloor, parseCreditsGuard, parseSavedGuard } from "./partyGuard";

describe("parseCreditsGuard", () => {
  const box = { x: 0.1, y: 0.7, w: 0.4, h: 0.2 };

  it("accepts a box with a style", () => {
    expect(parseCreditsGuard({ enabled: true, box, style: "blur" })).toEqual({ enabled: true, box, style: "blur" });
  });

  it("keeps the box inside the picture", () => {
    expect(parseCreditsGuard({ enabled: true, box: { x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, style: "black" })).toMatchObject({
      box: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    });
  });

  it("rejects a wrong shape", () => {
    expect(parseCreditsGuard(null)).toHaveProperty("error");
    expect(parseCreditsGuard({ enabled: "yes", box, style: "black" })).toHaveProperty("error");
    expect(parseCreditsGuard({ enabled: true, box: { x: 0 }, style: "black" })).toHaveProperty("error");
    expect(parseCreditsGuard({ enabled: true, box, style: "pink" })).toHaveProperty("error");
    expect(parseCreditsGuard({ enabled: true, style: "black" })).toHaveProperty("error");
  });
});

describe("clampStartFloor", () => {
  it("rounds into 0-60", () => {
    expect([clampStartFloor(-4), clampStartFloor(12.6), clampStartFloor(900)]).toEqual([0, 13, 60]);
  });
});

describe("parseSavedGuard", () => {
  it("reads what was saved", () => {
    const guard = { enabled: true, box: { x: 0.1, y: 0.1, w: 0.3, h: 0.3 }, style: "blur" as const };
    expect(parseSavedGuard(JSON.stringify({ startFloor: 20, creditsGuard: guard }))).toEqual({ startFloor: 20, creditsGuard: guard });
  });

  it("falls back to defaults on an empty or broken row", () => {
    const defaults = { startFloor: DEFAULT_START_FLOOR, creditsGuard: DEFAULT_CREDITS_GUARD };
    expect(parseSavedGuard("{}")).toEqual(defaults);
    expect(parseSavedGuard("not json")).toEqual(defaults);
  });
});
