import { describe, expect, it } from "vitest";
import { skipTarget } from "./partySkip";

describe("skipTarget", () => {
  it("lands 3 seconds before the end of a long clip", () => {
    expect(skipTarget(90)).toBe(87);
    expect(skipTarget(89.46)).toBe(86.5);
  });

  it("goes to 0 for a clip of 3 seconds or less", () => {
    expect(skipTarget(2)).toBe(0);
    expect(skipTarget(3)).toBe(0);
  });

  it("is null while the duration is unknown", () => {
    expect(skipTarget(null)).toBeNull();
    expect(skipTarget(undefined)).toBeNull();
    expect(skipTarget(0)).toBeNull();
    expect(skipTarget(Number.NaN)).toBeNull();
  });
});
