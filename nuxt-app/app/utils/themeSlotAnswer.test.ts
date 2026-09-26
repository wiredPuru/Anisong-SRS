import { describe, expect, it } from "vitest";
import { evaluateThemeSlotAnswer, formatThemeSlot, normalizeThemeSlot, formatThemeSlotLabel, isInsertThemeSlot } from "./themeSlotAnswer";

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

describe("theme slot labels", () => {
  it.each([
    ["IN-21049", "Insert"],
    ["OP1", "OP1"],
    ["ED7-ShounenHen", "ED7-ShounenHen"],
    ["IN1", "IN1"],
  ])("labels %s as %s", (slot, label) => {
    expect(formatThemeSlotLabel(slot)).toBe(label);
  });

  it("recognizes only the IN-<id> shape as an insert", () => {
    expect(isInsertThemeSlot(" IN-7 ")).toBe(true);
    expect(isInsertThemeSlot("IN-")).toBe(false);
  });
});

describe("insert slots in grading", () => {
  it("normalizes an insert slot to an unnumbered Insert", () => {
    expect(normalizeThemeSlot("IN-21049")).toEqual({ type: "IN", number: 0 });
  });

  it("formats an Insert pick without a number", () => {
    expect(formatThemeSlot({ type: "IN", number: 3 })).toBe("Insert");
  });

  it("passes any Insert pick against an insert, whatever the number", () => {
    expect(evaluateThemeSlotAnswer("IN-21049", { type: "IN", number: 7 })).toBe(true);
  });

  it("never crosses an insert with an opening or ending", () => {
    expect(evaluateThemeSlotAnswer("OP1", { type: "IN", number: 1 })).toBe(false);
    expect(evaluateThemeSlotAnswer("IN-21049", { type: "OP", number: 1 })).toBe(false);
  });

  it("still requires the number for openings and endings", () => {
    expect(evaluateThemeSlotAnswer("ED2", { type: "ED", number: 2 })).toBe(true);
    expect(evaluateThemeSlotAnswer("ED2", { type: "ED", number: 3 })).toBe(false);
  });
});
