import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeNextBoxState } from "./study.ts";

const REQUIRED_STREAK = 3;
const NOW = new Date("2026-09-04T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeNextBoxState", () => {
  it("resets a fail from any box to box 1 with streak 0", () => {
    const result = computeNextBoxState(3, 0, "fail", REQUIRED_STREAK);
    expect(result.box).toBe(1);
    expect(result.streak).toBe(0);
  });

  it("resets a fail from box 1 with an in-progress streak, not just the box", () => {
    const result = computeNextBoxState(1, 2, "fail", REQUIRED_STREAK);
    expect(result.box).toBe(1);
    expect(result.streak).toBe(0);
  });

  it("keeps a box-1 pass at box 1 while below the required streak", () => {
    const result = computeNextBoxState(1, 0, "pass", REQUIRED_STREAK);
    expect(result.box).toBe(1);
    expect(result.streak).toBe(1);
  });

  it("advances a box-1 pass to box 2 once the required streak is reached, resetting streak", () => {
    const result = computeNextBoxState(1, REQUIRED_STREAK - 1, "pass", REQUIRED_STREAK);
    expect(result.box).toBe(2);
    expect(result.streak).toBe(0);
  });

  it("advances a pass at box 2 to box 3", () => {
    const result = computeNextBoxState(2, 0, "pass", REQUIRED_STREAK);
    expect(result.box).toBe(3);
    expect(result.streak).toBe(0);
  });

  it("caps a pass at the max box (5) instead of advancing past it", () => {
    const result = computeNextBoxState(5, 0, "pass", REQUIRED_STREAK);
    expect(result.box).toBe(5);
  });

  it.each([
    [1, 0],
    [2, 1],
    [3, 3],
    [4, 7],
    [5, 14],
  ])("sets nextReviewAt %i days out for box %i", (box, days) => {
    // Land exactly on box `box` via a pass from box - 1 (or from box 1 at the
    // required streak), so the interval attached to that box is observed
    // directly rather than inferred.
    const result =
      box === 1
        ? computeNextBoxState(1, 0, "pass", REQUIRED_STREAK + 1)
        : box === 2
          ? computeNextBoxState(1, REQUIRED_STREAK - 1, "pass", REQUIRED_STREAK)
          : computeNextBoxState(box - 1, 0, "pass", REQUIRED_STREAK);

    expect(result.box).toBe(box);
    expect(result.nextReviewAt.getTime()).toBe(NOW.getTime() + days * DAY_MS);
  });
});
