import { describe, expect, it } from "vitest";
import { remainingRevealSeconds } from "./autoReveal.ts";

describe("remainingRevealSeconds", () => {
  it("shows the full interval before anything elapses", () => {
    expect(remainingRevealSeconds(5000)).toBe(5);
  });

  it("rounds a partial second up", () => {
    expect(remainingRevealSeconds(5000, 1200)).toBe(4);
    expect(remainingRevealSeconds(5000, 4999)).toBe(1);
  });

  it("reaches zero exactly when the interval is used up", () => {
    expect(remainingRevealSeconds(5000, 5000)).toBe(0);
  });

  it("never goes negative when the timer fires late", () => {
    expect(remainingRevealSeconds(5000, 6300)).toBe(0);
  });
});
