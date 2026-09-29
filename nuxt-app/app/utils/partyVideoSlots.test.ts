import { describe, expect, it } from "vitest";
import { assignPartyVideoSlots } from "./partyVideoSlots";

describe("assignPartyVideoSlots", () => {
  it("keeps preloaded songs on the same elements as the current song changes", () => {
    const first = assignPartyVideoSlots([null, null, null], ["one", "two", "three"]);
    const second = assignPartyVideoSlots(first, ["two", "three", "four"]);
    expect(second).toEqual(["four", "two", "three"]);
  });

  it("reuses freed elements for a jump outside the preload window", () => {
    expect(assignPartyVideoSlots(["one", "two", "three"], ["seven", "eight", "nine"]))
      .toEqual(["seven", "eight", "nine"]);
  });

  it("ignores duplicate and empty tokens and releases unused elements", () => {
    expect(assignPartyVideoSlots(["one", "two", "three"], ["two", "two", "", "four"]))
      .toEqual(["four", "two", null]);
  });
});
