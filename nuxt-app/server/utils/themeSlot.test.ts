import { describe, expect, it } from "vitest";
import { insertSlot, isInsertSlot, filterByThemeTypes, parseThemeTypes, themeSlotType } from "./themeSlot.ts";

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


describe("themeSlotType", () => {
  it("names openings, endings and inserts", () => {
    expect(themeSlotType("OP1")).toBe("OP");
    expect(themeSlotType("ed2")).toBe("ED");
    expect(themeSlotType("IN-21049")).toBe("IN");
    expect(themeSlotType("XX")).toBeNull();
  });
});

describe("parseThemeTypes", () => {
  it("accepts a list, treats missing as all, rejects junk", () => {
    expect(parseThemeTypes(undefined)).toEqual([]);
    expect(parseThemeTypes(["OP", "OP", "ED"])).toEqual(["OP", "ED"]);
    expect(parseThemeTypes(["OPENING"])).toEqual({ error: "themeTypes must be a list of OP, ED or IN" });
    expect(parseThemeTypes("OP")).toEqual({ error: "themeTypes must be a list of OP, ED or IN" });
  });
});

describe("filterByThemeTypes", () => {
  const themes = [{ themeSlot: "OP1" }, { themeSlot: "ED1" }, { themeSlot: "IN-5" }];

  it("keeps everything when no type is chosen", () => {
    expect(filterByThemeTypes(themes, [])).toEqual(themes);
  });

  it("keeps only the chosen types", () => {
    expect(filterByThemeTypes(themes, ["OP"])).toEqual([{ themeSlot: "OP1" }]);
    expect(filterByThemeTypes(themes, ["ED", "IN"])).toHaveLength(2);
  });
});
