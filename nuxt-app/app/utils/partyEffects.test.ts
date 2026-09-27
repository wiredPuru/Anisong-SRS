import { describe, expect, it } from "vitest";
import { effectStrength, pixelBlockSize } from "./partyEffects";

describe("effectStrength", () => {
  it("holds steady without decay", () => {
    expect(effectStrength(20, false, 10, 999)).toBe(20);
  });

  it("falls linearly to 0 over the decay time and stays there", () => {
    expect(effectStrength(20, true, 10, 0)).toBe(20);
    expect(effectStrength(20, true, 10, 5)).toBe(10);
    expect(effectStrength(20, true, 10, 10)).toBe(0);
    expect(effectStrength(20, true, 10, 30)).toBe(0);
  });

  it("treats time before the start as the start", () => {
    expect(effectStrength(20, true, 10, -4)).toBe(20);
  });

  it("is 0 when the effect is off", () => {
    expect(effectStrength(0, true, 10, 0)).toBe(0);
  });
});

describe("pixelBlockSize", () => {
  it("rounds the block size and switches off below 2px", () => {
    expect(pixelBlockSize(32, true, 10, 5)).toBe(16);
    expect(pixelBlockSize(32, true, 10, 9.6)).toBe(0);
    expect(pixelBlockSize(0, false, 10, 0)).toBe(0);
  });
});
