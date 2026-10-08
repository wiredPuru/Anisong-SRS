import { describe, expect, it } from "vitest";
import { PLAY_LENGTH_OPTIONS, formatPlayLength, parsePlayLength } from "./listenPlayLength";

describe("parsePlayLength", () => {
  it("reads every offered length back", () => {
    for (const seconds of PLAY_LENGTH_OPTIONS) {
      expect(parsePlayLength(String(seconds))).toBe(seconds);
    }
  });

  it("treats nothing stored, blanks and junk as the full song", () => {
    expect(parsePlayLength(null)).toBe(0);
    expect(parsePlayLength("")).toBe(0);
    expect(parsePlayLength("  ")).toBe(0);
    expect(parsePlayLength("abc")).toBe(0);
    expect(parsePlayLength("NaN")).toBe(0);
  });

  it("rejects values that are not an offered length", () => {
    expect(parsePlayLength("7")).toBe(0);
    expect(parsePlayLength("-30")).toBe(0);
    expect(parsePlayLength("30.5")).toBe(0);
    expect(parsePlayLength("9999")).toBe(0);
  });
});

describe("formatPlayLength", () => {
  it("names the whole song", () => {
    expect(formatPlayLength(0)).toBe("Full song");
  });

  it("uses seconds under two minutes and minutes from there", () => {
    expect(formatPlayLength(10)).toBe("10s");
    expect(formatPlayLength(90)).toBe("90s");
    expect(formatPlayLength(120)).toBe("2 min");
  });
});
