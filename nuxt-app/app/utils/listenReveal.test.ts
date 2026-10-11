import { describe, expect, it } from "vitest";
import { clampRevealSeconds, isAutoRevealMode, readStoredAutoRevealMode, revealTargets } from "./listenReveal";

describe("isAutoRevealMode", () => {
  it("accepts the three modes and nothing else", () => {
    for (const mode of ["off", "info", "both"]) expect(isAutoRevealMode(mode)).toBe(true);
    expect(isAutoRevealMode("all")).toBe(false);
    expect(isAutoRevealMode(null)).toBe(false);
  });
});

describe("clampRevealSeconds", () => {
  it("keeps a value in 1-30 and rounds it", () => {
    expect(clampRevealSeconds(7.4)).toBe(7);
    expect(clampRevealSeconds(0)).toBe(1);
    expect(clampRevealSeconds(99)).toBe(30);
  });

  it("falls back to the default for a non-number", () => {
    expect(clampRevealSeconds(Number.NaN)).toBe(5);
    expect(clampRevealSeconds(Number("abc"))).toBe(5);
  });
});

describe("revealTargets", () => {
  it("maps each mode to what it veils", () => {
    expect(revealTargets("off")).toEqual({ visual: false, info: false });
    expect(revealTargets("info")).toEqual({ visual: false, info: true });
    expect(revealTargets("both")).toEqual({ visual: true, info: true });
  });
});

describe("readStoredAutoRevealMode", () => {
  it("keeps a current mode", () => {
    expect(readStoredAutoRevealMode("info")).toBe("info");
    expect(readStoredAutoRevealMode("both")).toBe("both");
  });

  it("moves the retired video mode to both", () => {
    expect(readStoredAutoRevealMode("video")).toBe("both");
  });

  it("falls back to off", () => {
    expect(readStoredAutoRevealMode(null)).toBe("off");
    expect(readStoredAutoRevealMode("nope")).toBe("off");
  });
});
