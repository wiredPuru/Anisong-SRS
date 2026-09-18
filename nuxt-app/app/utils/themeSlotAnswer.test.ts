import { describe, expect, it } from "vitest";
import { evaluateThemeSlotAnswer, formatThemeSlot, normalizeThemeSlot } from "./themeSlotAnswer";

describe("normalizeThemeSlot", () => {
  it("parses a plain slot", () => {
    expect(normalizeThemeSlot("OP1")).toEqual({ type: "OP", number: 1 });
    expect(normalizeThemeSlot("ED2")).toEqual({ type: "ED", number: 2 });
  });

  it("ignores a version suffix", () => {
    expect(normalizeThemeSlot("ED7-ShounenHen")).toEqual({ type: "ED", number: 7 });
    expect(normalizeThemeSlot("OP2-EN")).toEqual({ type: "OP", number: 2 });
    expect(normalizeThemeSlot("ED1-TV")).toEqual({ type: "ED", number: 1 });
  });

  it("parses a two-digit number", () => {
    expect(normalizeThemeSlot("ED30")).toEqual({ type: "ED", number: 30 });
    expect(normalizeThemeSlot("OP19")).toEqual({ type: "OP", number: 19 });
  });

  it("is case-insensitive on the type", () => {
    expect(normalizeThemeSlot("op1")).toEqual({ type: "OP", number: 1 });
    expect(normalizeThemeSlot("ed2")).toEqual({ type: "ED", number: 2 });
  });

  it("returns null for a malformed or empty value", () => {
    expect(normalizeThemeSlot("")).toBeNull();
    expect(normalizeThemeSlot("Insert1")).toBeNull();
    expect(normalizeThemeSlot("Ending Theme")).toBeNull();
  });
});

describe("formatThemeSlot", () => {
  it("joins type and number with no separator", () => {
    expect(formatThemeSlot({ type: "OP", number: 1 })).toBe("OP1");
    expect(formatThemeSlot({ type: "ED", number: 30 })).toBe("ED30");
  });
});

describe("evaluateThemeSlotAnswer", () => {
  it("passes a matching pick", () => {
    expect(evaluateThemeSlotAnswer("OP1", { type: "OP", number: 1 })).toBe(true);
  });

  it("fails a wrong number", () => {
    expect(evaluateThemeSlotAnswer("OP1", { type: "OP", number: 2 })).toBe(false);
  });

  it("fails a wrong type", () => {
    expect(evaluateThemeSlotAnswer("OP1", { type: "ED", number: 1 })).toBe(false);
  });

  it("passes a suffixed expected value matched against the plain pick", () => {
    expect(evaluateThemeSlotAnswer("ED7-ShounenHen", { type: "ED", number: 7 })).toBe(true);
    expect(evaluateThemeSlotAnswer("OP2-EN", { type: "OP", number: 2 })).toBe(true);
  });

  it("fails a pick that only differs by the suffix's implied version", () => {
    expect(evaluateThemeSlotAnswer("OP2-EN", { type: "OP", number: 3 })).toBe(false);
  });

  it("fails a malformed expected value", () => {
    expect(evaluateThemeSlotAnswer("", { type: "OP", number: 1 })).toBe(false);
  });
});
