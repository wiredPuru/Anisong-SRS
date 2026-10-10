import { describe, expect, it } from "vitest";
import { effectiveThemeTypes, orderByMix, pickMixedType, typeOfSlot } from "./themeMix.ts";

const mix = { OP: 70, ED: 30, IN: 0 };

describe("typeOfSlot", () => {
  it("reads the type from a slot", () => {
    expect(typeOfSlot("OP2")).toBe("OP");
    expect(typeOfSlot("ed1")).toBe("ED");
    expect(typeOfSlot("IN-5")).toBe("IN");
    expect(typeOfSlot("?")).toBeNull();
  });
});

describe("effectiveThemeTypes", () => {
  it("leaves the chosen types alone without a mix", () => {
    expect(effectiveThemeTypes([], null)).toEqual([]);
    expect(effectiveThemeTypes(["OP"], null)).toEqual(["OP"]);
  });

  it("drops zero-weight types", () => {
    expect(effectiveThemeTypes([], mix)).toEqual(["OP", "ED"]);
    expect(effectiveThemeTypes(["ED", "IN"], mix)).toEqual(["ED"]);
  });
});

describe("pickMixedType", () => {
  it("follows the weights", () => {
    const all = new Set(["OP", "ED", "IN"] as const);
    expect(pickMixedType(mix, all, () => 0)).toBe("OP");
    expect(pickMixedType(mix, all, () => 0.69)).toBe("OP");
    expect(pickMixedType(mix, all, () => 0.71)).toBe("ED");
  });

  it("skips types with nothing left and never picks a zero weight", () => {
    expect(pickMixedType(mix, new Set(["ED", "IN"] as const), () => 0)).toBe("ED");
    expect(pickMixedType(mix, new Set(["IN"] as const), () => 0)).toBeNull();
  });
});

describe("orderByMix", () => {
  const items = ["OP1", "OP2", "OP3", "ED1", "ED2", "IN-1"].map((themeSlot) => ({ themeSlot }));

  it("keeps each type's order, drops zero-weight types and uses every other item", () => {
    const out = orderByMix(items, (i) => typeOfSlot(i.themeSlot), mix, () => 0.5).map((i) => i.themeSlot);
    expect(out).toHaveLength(5);
    expect(out.filter((s) => s.startsWith("OP"))).toEqual(["OP1", "OP2", "OP3"]);
    expect(out.filter((s) => s.startsWith("ED"))).toEqual(["ED1", "ED2"]);
  });

  it("hits the target ratio over many songs", () => {
    const many = Array.from({ length: 1000 }, (_, i) => ({ themeSlot: i % 2 ? "OP1" : "ED1" }));
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const first = orderByMix(many, (i) => typeOfSlot(i.themeSlot), mix, random).slice(0, 200);
    const ops = first.filter((i) => i.themeSlot === "OP1").length;
    expect(ops).toBeGreaterThan(120);
    expect(ops).toBeLessThan(160);
  });
});
