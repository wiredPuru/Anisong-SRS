import { describe, expect, it } from "vitest";
import { MAX_BURIED_CARD_IDS, MAX_RECENT_CARD_IDS, parseBuriedCardIds, parseCardIdList, parseRecentCardIds } from "./studyRecent.ts";

describe("parseRecentCardIds", () => {
  it("returns an empty list when the param is absent or empty", () => {
    expect(parseRecentCardIds(undefined)).toEqual({ recentIds: [] });
    expect(parseRecentCardIds("")).toEqual({ recentIds: [] });
  });

  it("parses comma-separated ids in order", () => {
    expect(parseRecentCardIds("12,7,30")).toEqual({ recentIds: [12, 7, 30] });
    expect(parseRecentCardIds("5")).toEqual({ recentIds: [5] });
  });

  it("keeps only the latest position of a repeated id", () => {
    expect(parseRecentCardIds("3,8,3,9")).toEqual({ recentIds: [8, 3, 9] });
  });

  it("rejects non-numeric, zero, negative, fractional, and blank entries", () => {
    for (const raw of ["abc", "1,x", "0", "-4", "2.5", "1,,2", "1,"]) {
      expect(parseRecentCardIds(raw)).toHaveProperty("error");
    }
  });

  it("rejects a non-string value such as a repeated query param", () => {
    expect(parseRecentCardIds(["1", "2"])).toHaveProperty("error");
  });

  it("rejects more ids than the cap", () => {
    const atCap = Array.from({ length: MAX_RECENT_CARD_IDS }, (_, index) => index + 1).join(",");
    expect(parseRecentCardIds(atCap)).toHaveProperty("recentIds");
    expect(parseRecentCardIds(`${atCap},99`)).toHaveProperty("error");
  });
});

describe("parseCardIdList", () => {
  it("names the param in its error", () => {
    expect(parseCardIdList("x", "bury", 5)).toEqual({ error: "bury must be a comma-separated list of card ids" });
  });

  it("applies the cap it is given", () => {
    expect(parseCardIdList("1,2,3", "bury", 3)).toEqual({ ids: [1, 2, 3] });
    expect(parseCardIdList("1,2,3,4", "bury", 3)).toHaveProperty("error");
  });
});

describe("parseBuriedCardIds", () => {
  it("returns no ids when the param is absent or empty", () => {
    expect(parseBuriedCardIds(undefined)).toEqual({ buriedIds: [] });
    expect(parseBuriedCardIds("")).toEqual({ buriedIds: [] });
  });

  it("parses ids and drops duplicates", () => {
    expect(parseBuriedCardIds("4,9,4")).toEqual({ buriedIds: [9, 4] });
  });

  it("rejects malformed, zero, and negative entries", () => {
    for (const raw of ["abc", "0", "-3", "1,,2"]) {
      expect(parseBuriedCardIds(raw)).toHaveProperty("error");
    }
  });

  it("allows far more ids than the recent list, up to its own cap", () => {
    const atCap = Array.from({ length: MAX_BURIED_CARD_IDS }, (_, index) => index + 1).join(",");
    expect(parseBuriedCardIds(atCap)).toHaveProperty("buriedIds");
    expect(parseBuriedCardIds(`${atCap},9999`)).toHaveProperty("error");
  });
});
