import { describe, expect, it } from "vitest";
import { COVER_TINT_TOKENS, coverInitial, coverTint } from "./coverFallback";

describe("coverTint", () => {
  it("is stable per id and cycles through the tint tokens", () => {
    expect(coverTint(5)).toBe(coverTint(5));
    expect(COVER_TINT_TOKENS.map((_, i) => coverTint(i))).toEqual([...COVER_TINT_TOKENS]);
    expect(coverTint(4)).toBe(coverTint(0));
  });

  it("handles negative and fractional ids", () => {
    expect(COVER_TINT_TOKENS).toContain(coverTint(-3));
    expect(COVER_TINT_TOKENS).toContain(coverTint(2.7));
  });
});

describe("coverInitial", () => {
  it("takes the first letter, upper-cased", () => {
    expect(coverInitial("macross Frontier")).toBe("M");
    expect(coverInitial("  K-ON!")).toBe("K");
  });

  it("skips leading punctuation and keeps non-Latin letters and digits", () => {
    expect(coverInitial('"Oshi no Ko"')).toBe("O");
    expect(coverInitial("【推しの子】")).toBe("推");
    expect(coverInitial("86 EIGHTY-SIX")).toBe("8");
  });

  it("falls back to a question mark", () => {
    expect(coverInitial("")).toBe("?");
    expect(coverInitial("!!!")).toBe("?");
  });
});
