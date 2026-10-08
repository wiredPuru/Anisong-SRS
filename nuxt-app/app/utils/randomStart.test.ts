import { describe, expect, it } from "vitest";
import { randomStartTime } from "./randomStart";

const low = () => 0;
const high = () => 0.999999;

describe("randomStartTime without a play length", () => {
  it("keeps clear of the last 15 seconds", () => {
    expect(randomStartTime(90, 0, low)).toBe(0);
    expect(randomStartTime(90, 0, high)).toBeCloseTo(75, 3);
  });

  it("falls back to anywhere in a clip of 15 seconds or less", () => {
    expect(randomStartTime(10, 0, high)).toBeCloseTo(10, 3);
  });

  it("is what an omitted length gives", () => {
    expect(randomStartTime(90, undefined, high)).toBeCloseTo(75, 3);
  });
});

describe("randomStartTime with a play length", () => {
  it("leaves the whole length before the end", () => {
    expect(randomStartTime(90, 30, high)).toBeCloseTo(60, 3);
    expect(randomStartTime(90, 30, low)).toBe(0);
  });

  it("still keeps the 15 second margin for a short length", () => {
    expect(randomStartTime(90, 10, high)).toBeCloseTo(75, 3);
  });

  it("uses the exact length when the margin does not fit", () => {
    expect(randomStartTime(20, 10, high)).toBeCloseTo(5, 3);
    expect(randomStartTime(14, 10, high)).toBeCloseTo(4, 3);
  });

  it("starts at 0 when the clip is no longer than the length", () => {
    expect(randomStartTime(10, 10, high)).toBe(0);
    expect(randomStartTime(8, 30, high)).toBe(0);
  });

  it("never leaves less than the length to play when the clip is long enough", () => {
    for (const duration of [12, 16, 31, 45, 90, 200]) {
      for (const length of [10, 20, 30, 60]) {
        if (duration <= length) continue;
        expect(randomStartTime(duration, length, high) + length).toBeLessThanOrEqual(duration);
      }
    }
  });
});
