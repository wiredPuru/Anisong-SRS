import { describe, expect, it } from "vitest";
import { evaluateArtistAnswer } from "./artistAnswer";

const card = { artistName: "Yui Hori" };

describe("evaluateArtistAnswer", () => {
  it("accepts an exact match", () => {
    expect(evaluateArtistAnswer(card, "Yui Hori")).toBe(true);
  });

  it("ignores case and spacing", () => {
    expect(evaluateArtistAnswer(card, "  yui  HORI ")).toBe(true);
    expect(evaluateArtistAnswer(card, "YuiHori")).toBe(true);
  });

  it("folds full-width characters typed on a Japanese IME", () => {
    expect(evaluateArtistAnswer(card, "Ｙｕｉ Ｈｏｒｉ")).toBe(true);
  });

  it("rejects a blank or whitespace-only answer", () => {
    expect(evaluateArtistAnswer(card, "")).toBe(false);
    expect(evaluateArtistAnswer(card, "   ")).toBe(false);
  });

  it("rejects a different artist and does no fuzzy matching", () => {
    expect(evaluateArtistAnswer(card, "Yui Horie")).toBe(false);
    expect(evaluateArtistAnswer(card, "Yui")).toBe(false);
  });
});
