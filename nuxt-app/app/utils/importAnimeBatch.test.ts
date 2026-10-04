import { describe, expect, it, vi } from "vitest";
import { importAnimeBatch, type ImportOneResult } from "./importAnimeBatch";

const ok = (added: number, alreadyAdded = 0): ImportOneResult => ({ title: "T", added, alreadyAdded, skipped: 0 });

describe("importAnimeBatch", () => {
  it("imports in order and totals the added cards", async () => {
    const importOne = vi.fn().mockResolvedValueOnce(ok(2)).mockResolvedValueOnce(ok(1));
    const result = await importAnimeBatch([5, 6], importOne);
    expect(importOne.mock.calls.map(([id]) => id)).toEqual([5, 6]);
    expect(result).toMatchObject({ done: 2, total: 2, added: 3, failed: 0, empty: 0, cancelled: false });
  });

  it("counts a failure and keeps going", async () => {
    const importOne = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(ok(1));
    expect(await importAnimeBatch([1, 2], importOne)).toMatchObject({ done: 2, added: 1, failed: 1 });
  });

  it("counts a show with nothing addable as empty", async () => {
    expect(await importAnimeBatch([1], vi.fn().mockResolvedValue(ok(0)))).toMatchObject({ added: 0, empty: 1 });
    expect(await importAnimeBatch([1], vi.fn().mockResolvedValue(ok(0, 2)))).toMatchObject({ empty: 0 });
  });

  it("stops between shows when asked and reports it", async () => {
    let calls = 0;
    const importOne = vi.fn().mockImplementation(async () => { calls += 1; return ok(1); });
    const result = await importAnimeBatch([1, 2, 3], importOne, { shouldStop: () => calls >= 1 });
    expect(result).toMatchObject({ done: 1, total: 3, cancelled: true });
    expect(importOne).toHaveBeenCalledTimes(1);
  });

  it("handles an empty list", async () => {
    expect(await importAnimeBatch([], vi.fn())).toMatchObject({ done: 0, total: 0, cancelled: false });
  });

  it("totals the cards that joined a deck", async () => {
    const importOne = vi.fn()
      .mockResolvedValueOnce({ ...ok(2), addedToDeck: 2 })
      .mockResolvedValueOnce({ ...ok(0, 1), addedToDeck: 1 })
      .mockResolvedValueOnce(ok(1));
    expect(await importAnimeBatch([1, 2, 3], importOne)).toMatchObject({ added: 3, addedToDeck: 3 });
  });
});
