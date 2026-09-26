import { describe, expect, it } from "vitest";
import { insertSlot, isInsertSlot } from "./themeSlot.ts";

describe("insert slots", () => {
  it("names an insert by its AnisongDB song id", () => {
    expect(insertSlot(21049)).toBe("IN-21049");
  });

  it.each([
    ["IN-21049", true],
    [" IN-7 ", true],
    ["IN1", false],
    ["IN-", false],
    ["OP1", false],
    ["ED2-EN", false],
  ])("isInsertSlot(%s) is %s", (slot, expected) => {
    expect(isInsertSlot(slot)).toBe(expected);
  });
});
