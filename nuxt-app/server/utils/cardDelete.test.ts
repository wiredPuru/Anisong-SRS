import { describe, expect, it } from "vitest";
import { BULK_DELETE_MAX, hasAnyCardsIdsFilter, parseDeleteBody, parseMatchingQuery } from "./cardDelete.ts";

describe("parseDeleteBody", () => {
  it("accepts a single id", () => {
    expect(parseDeleteBody({ id: 7 })).toEqual({ kind: "single", id: 7 });
  });

  it("accepts a list of ids", () => {
    expect(parseDeleteBody({ ids: [1, 2, 3] })).toEqual({ kind: "bulk", ids: [1, 2, 3] });
  });

  it("rejects an empty ids list", () => {
    expect(parseDeleteBody({ ids: [] })).toHaveProperty("error");
  });

  it.each([[[1, 2.5]], [[1, -3]], [[1, "2"]], [[0]]])("rejects non-positive-integer ids %j", (ids) => {
    expect(parseDeleteBody({ ids })).toHaveProperty("error");
  });

  it("rejects more ids than the cap", () => {
    const ids = Array.from({ length: BULK_DELETE_MAX + 1 }, (_, i) => i + 1);
    expect(parseDeleteBody({ ids })).toHaveProperty("error");
    expect(parseDeleteBody({ ids: ids.slice(1) })).toEqual({ kind: "bulk", ids: ids.slice(1) });
  });

  it.each([[{}], [null], ["7"], [{ id: "7" }]])("rejects a body with no usable id %j", (body) => {
    expect(parseDeleteBody(body)).toHaveProperty("error");
  });
});

describe("parseMatchingQuery", () => {
  it("trims a real search", () => {
    expect(parseMatchingQuery("  lisa ")).toBe("lisa");
  });

  it("rejects a missing, blank, or non-string query", () => {
    expect(parseMatchingQuery(undefined)).toBeNull();
    expect(parseMatchingQuery("")).toBeNull();
    expect(parseMatchingQuery("   ")).toBeNull();
    expect(parseMatchingQuery(["a", "b"])).toBeNull();
  });
});

describe("hasAnyCardsIdsFilter", () => {
  it("rejects a blank query with the toggle off", () => {
    expect(hasAnyCardsIdsFilter(null, false)).toBe(false);
  });

  it("accepts a blank query with the toggle on", () => {
    expect(hasAnyCardsIdsFilter(null, true)).toBe(true);
  });

  it("accepts a real query with the toggle off", () => {
    expect(hasAnyCardsIdsFilter("lisa", false)).toBe(true);
  });

  it("accepts a real query with the toggle on", () => {
    expect(hasAnyCardsIdsFilter("lisa", true)).toBe(true);
  });
});
