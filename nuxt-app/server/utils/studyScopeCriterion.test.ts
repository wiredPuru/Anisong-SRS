import { describe, expect, it, vi } from "vitest";
import type { StudyScope } from "./cards.ts";

// The three non-deck scopes must answer without touching the database at all,
// which is the whole reason resolveScopeCriterion returns before the lookup.
// Making db.select throw is what proves it, rather than trusting the branch.
vi.mock("../db/client.ts", () => ({
  db: {
    select: () => {
      throw new Error("resolveScopeCriterion reached the database for a scope that has no deck row");
    },
  },
}));

const { resolveScopeCriterion } = await import("./decks.ts");

describe("resolveScopeCriterion", () => {
  it.each([
    ["all", { type: "all" }],
    ["artist", { type: "artist", id: 3 }],
    ["anime", { type: "anime", id: 7 }],
  ] as [string, StudyScope][])("returns the title track for the %s scope without a lookup", (_label, scope) => {
    expect(resolveScopeCriterion(scope)).toBe("title");
  });

  it("looks the criterion up for a created deck", () => {
    expect(() => resolveScopeCriterion({ type: "created", id: 1 })).toThrow(/reached the database/);
  });
});
