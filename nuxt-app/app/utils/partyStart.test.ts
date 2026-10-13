import { describe, expect, it } from "vitest";
import { partyStartTime } from "./partyStart";

describe("partyStartTime", () => {
  it("is 0 when the start is not random", () => {
    expect(partyStartTime(0, 90, 15, 10)).toBe(0);
  });

  it("never starts before the floor", () => {
    expect(partyStartTime(0.001, 90, 15, 10)).toBeGreaterThanOrEqual(10);
  });

  it("reaches the tail margin at the top of the range", () => {
    expect(partyStartTime(1, 90, 15, 10)).toBe(75);
  });

  it("matches the old behaviour with no floor", () => {
    expect(partyStartTime(0.5, 90, 15, 0)).toBe(37.5);
  });

  it("ignores a floor the clip is too short for", () => {
    expect(partyStartTime(0.5, 20, 15, 10)).toBe(2.5);
  });

  it("is 0 while the duration is unknown", () => {
    expect(partyStartTime(0.5, Number.NaN, 15, 10)).toBe(0);
  });
});
