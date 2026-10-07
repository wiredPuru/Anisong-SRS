import { describe, expect, it } from "vitest";
import { orderCardsByIds } from "./listenQueue.ts";

describe("orderCardsByIds", () => {
  const cards = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("follows the picked id order, not the loaded order", () => {
    expect(orderCardsByIds([3, 1, 2], cards)).toEqual([{ id: 3 }, { id: 1 }, { id: 2 }]);
  });

  it("drops an id that has no card", () => {
    expect(orderCardsByIds([2, 99, 1], cards)).toEqual([{ id: 2 }, { id: 1 }]);
  });

  it("plays a repeated id once", () => {
    expect(orderCardsByIds([1, 2, 1], cards)).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns nothing for an empty queue", () => {
    expect(orderCardsByIds([], cards)).toEqual([]);
  });
});
