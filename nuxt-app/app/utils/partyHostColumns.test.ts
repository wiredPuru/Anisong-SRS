import { describe, expect, it } from "vitest";
import { clampShares, DEFAULT_COLUMN_SHARES, moveDivider, parseStoredShares, type ColumnShares } from "./partyHostColumns";

const sum = (shares: number[]) => shares.reduce((a, b) => a + b, 0);

describe("parseStoredShares", () => {
  it("starts equal with nothing or garbage stored", () => {
    for (const raw of [null, "", "nope", "[1,2]", "[1,-1,1]", '{"a":1}', "[0,0,0]"]) {
      expect(parseStoredShares(raw)).toEqual(DEFAULT_COLUMN_SHARES);
    }
  });

  it("normalizes a stored layout to sum to one", () => {
    const shares = parseStoredShares("[2,1,1]");
    expect(shares[0]).toBeCloseTo(0.5);
    expect(sum(shares)).toBeCloseTo(1);
  });
});

describe("clampShares", () => {
  it("leaves a layout that fits untouched", () => {
    const shares: ColumnShares = [0.25, 0.5, 0.25];
    clampShares(shares, 1600).forEach((share, i) => expect(share).toBeCloseTo(shares[i]!));
  });

  it("widens a too-narrow column by taking from the others", () => {
    const shares = clampShares([0.1, 0.6, 0.3], 1300);
    expect(shares[0] * 1300).toBeCloseTo(260);
    expect(sum(shares)).toBeCloseTo(1);
    expect(shares[1]).toBeGreaterThan(shares[2]);
  });

  it("falls back to equal columns when three cannot fit", () => {
    expect(clampShares([0.5, 0.25, 0.25], 700)).toEqual(DEFAULT_COLUMN_SHARES);
  });
});

describe("moveDivider", () => {
  const equal: ColumnShares = [1 / 3, 1 / 3, 1 / 3];

  it("moves the first divider, leaving the third column alone", () => {
    const next = moveDivider(equal, 0, 400, 1500);
    expect(next[0]).toBeCloseTo(400 / 1500);
    expect(next[2]).toBeCloseTo(1 / 3);
    expect(sum(next)).toBeCloseTo(1);
  });

  it("moves the second divider, leaving the first column alone", () => {
    const next = moveDivider(equal, 1, 1200, 1500);
    expect(next[0]).toBeCloseTo(1 / 3);
    expect(next[2]).toBeCloseTo(300 / 1500);
  });

  it("stops at the minimum width on either side", () => {
    expect(moveDivider(equal, 0, 0, 1500)[0] * 1500).toBeCloseTo(260);
    expect(moveDivider(equal, 1, 1500, 1500)[2] * 1500).toBeCloseTo(260);
  });

  it("ignores a drag when the area is too narrow", () => {
    expect(moveDivider(equal, 0, 100, 600)).toBe(equal);
  });
});
