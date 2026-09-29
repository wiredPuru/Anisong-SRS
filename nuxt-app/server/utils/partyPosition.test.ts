import { describe, expect, it } from "vitest";
import { parsePartyPosition } from "./partyPosition.ts";

const valid = { token: "song-1", currentTime: 4, duration: 90, playing: false, blocked: true, elapsed: 3 };

describe("parsePartyPosition", () => {
  it("passes a blocked report to the host unchanged", () => {
    expect(parsePartyPosition(valid)).toEqual(valid);
    expect(parsePartyPosition({ ...valid, blocked: false, playing: true })).toEqual({ ...valid, blocked: false, playing: true });
  });

  it("requires a boolean blocked flag", () => {
    expect(parsePartyPosition({ ...valid, blocked: undefined })).toBeNull();
    expect(parsePartyPosition({ ...valid, blocked: "true" })).toBeNull();
  });

  it("keeps existing time validation and clamps negative elapsed time", () => {
    expect(parsePartyPosition({ ...valid, elapsed: -2 })).toEqual({ ...valid, elapsed: 0 });
    expect(parsePartyPosition({ ...valid, currentTime: -1 })).toBeNull();
    expect(parsePartyPosition({ ...valid, duration: Number.NaN })).toBeNull();
  });
});
