import { describe, expect, it } from "vitest";
import { RECENT_CARD_WINDOW, withBuriedCard, withRecentCard, withoutCard } from "./recentCards.ts";

describe("withRecentCard", () => {
  it("appends a new card to the end", () => {
    expect(withRecentCard([], 4)).toEqual([4]);
    expect(withRecentCard([4, 9], 2)).toEqual([4, 9, 2]);
  });

  it("moves a re-reviewed card to the end instead of listing it twice", () => {
    expect(withRecentCard([4, 9, 2], 9)).toEqual([4, 2, 9]);
  });

  it("drops the oldest card once the window is full", () => {
    const full = Array.from({ length: RECENT_CARD_WINDOW }, (_, index) => index + 1);
    const next = withRecentCard(full, 99);
    expect(next).toHaveLength(RECENT_CARD_WINDOW);
    expect(next[0]).toBe(2);
    expect(next.at(-1)).toBe(99);
  });

  it("does not mutate the input list", () => {
    const input = [1, 2];
    withRecentCard(input, 3);
    expect(input).toEqual([1, 2]);
  });

  it("returns an empty list for a zero window", () => {
    expect(withRecentCard([1, 2], 3, 0)).toEqual([]);
  });
});

describe("withBuriedCard", () => {
  it("appends a newly buried card", () => {
    expect(withBuriedCard([3], 8)).toEqual([3, 8]);
  });

  it("does not list a card twice", () => {
    expect(withBuriedCard([3, 8], 3)).toEqual([3, 8]);
  });

  it("keeps growing past the recent window", () => {
    let buried: number[] = [];
    for (let id = 1; id <= RECENT_CARD_WINDOW * 3; id += 1) buried = withBuriedCard(buried, id);
    expect(buried).toHaveLength(RECENT_CARD_WINDOW * 3);
  });
});

describe("withoutCard", () => {
  it("removes every occurrence of the card and leaves the rest in order", () => {
    expect(withoutCard([4, 9, 4, 2], 4)).toEqual([9, 2]);
  });

  it("returns an unchanged copy when the card is absent", () => {
    const input = [1, 2];
    const result = withoutCard(input, 7);
    expect(result).toEqual([1, 2]);
    expect(result).not.toBe(input);
  });
});
