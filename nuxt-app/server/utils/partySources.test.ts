import { describe, expect, it, vi } from "vitest";

vi.mock("../db/client.ts", () => ({ db: {} }));

const { parsePartySource, pickPartyQueue } = await import("./partySources.ts");

describe("parsePartySource", () => {
  it("accepts every scope type", () => {
    expect(parsePartySource({ scope: { type: "all" } })).toEqual({ scope: { type: "all" }, filters: null, shuffle: false });
    for (const type of ["artist", "anime", "created"] as const) {
      expect(parsePartySource({ scope: { type, id: 4 }, shuffle: true })).toEqual({ scope: { type, id: 4 }, filters: null, shuffle: true });
    }
  });

  it("parses a filters string the way Study does", () => {
    const result = parsePartySource({ scope: { type: "all" }, filters: JSON.stringify({ themeTypes: ["OP"] }) });
    expect("error" in result ? null : result.filters?.themeTypes).toEqual(["OP"]);
    expect(parsePartySource({ scope: { type: "all" }, filters: "{not json" })).toHaveProperty("error");
  });

  it("rejects a bad scope or shuffle", () => {
    expect(parsePartySource(null)).toHaveProperty("error");
    expect(parsePartySource({})).toHaveProperty("error");
    expect(parsePartySource({ scope: { type: "deck", id: 1 } })).toHaveProperty("error");
    expect(parsePartySource({ scope: { type: "artist" } })).toHaveProperty("error");
    expect(parsePartySource({ scope: { type: "anime", id: 0 } })).toHaveProperty("error");
    expect(parsePartySource({ scope: { type: "all" }, shuffle: "yes" })).toHaveProperty("error");
  });
});

describe("pickPartyQueue", () => {
  it("keeps order unless shuffled, and reports the full total", () => {
    expect(pickPartyQueue([1, 2, 3], false)).toEqual({ cardIds: [1, 2, 3], total: 3 });
    expect(pickPartyQueue([1, 2, 3], true, () => 0).cardIds).toEqual([2, 3, 1]);
  });

  it("caps the queue at the load limit after shuffling", () => {
    const ids = Array.from({ length: 2500 }, (_, i) => i + 1);
    const picked = pickPartyQueue(ids, false);
    expect(picked.cardIds).toHaveLength(2000);
    expect(picked.total).toBe(2500);
  });
});
