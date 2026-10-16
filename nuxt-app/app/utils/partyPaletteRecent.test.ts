import { describe, expect, it } from "vitest";
import { PALETTE_RECENT_LIMIT, parseRecent, pushRecent } from "./partyPaletteRecent";

const known = new Set(["a", "b", "c", "d", "e", "f", "g"]);

describe("parseRecent", () => {
  it("reads a stored list in order", () => {
    expect(parseRecent('["c","a"]', known)).toEqual(["c", "a"]);
  });

  it("returns nothing for missing, bad, or non-array JSON", () => {
    expect(parseRecent(null, known)).toEqual([]);
    expect(parseRecent("", known)).toEqual([]);
    expect(parseRecent("{not json", known)).toEqual([]);
    expect(parseRecent('{"a":1}', known)).toEqual([]);
    expect(parseRecent('"a"', known)).toEqual([]);
  });

  it("drops non-strings, unknown ids, and duplicates, and caps the list", () => {
    expect(parseRecent('["a",3,null,"gone","a","b"]', known)).toEqual(["a", "b"]);
    expect(parseRecent(JSON.stringify([...known]), known)).toHaveLength(PALETTE_RECENT_LIMIT);
  });
});

describe("pushRecent", () => {
  it("puts the pick first", () => {
    expect(pushRecent(["a", "b"], "c", known)).toEqual(["c", "a", "b"]);
  });

  it("moves an existing pick to the front rather than repeating it", () => {
    expect(pushRecent(["a", "b", "c"], "c", known)).toEqual(["c", "a", "b"]);
  });

  it("keeps only the newest five", () => {
    expect(pushRecent(["a", "b", "c", "d", "e"], "f", known)).toEqual(["f", "a", "b", "c", "d"]);
  });

  it("ignores a pick that is not a command", () => {
    expect(pushRecent(["a"], "gone", known)).toEqual(["a"]);
  });
});
