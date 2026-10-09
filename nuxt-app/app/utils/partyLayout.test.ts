import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  DEFAULT_SETTINGS,
  categoryOf,
  parseLayoutSettings,
  PIECE_CATEGORIES,
  frameStyle,
  movePlacement,
  PARTY_PIECES,
  parseLayout,
  resizePlacement,
  serializeLayout,
} from "./partyLayout";

describe("parseLayout", () => {
  it("gives the defaults for nothing or garbage", () => {
    for (const raw of [null, "", "not json", "42", "null", '{"v":2,"pieces":{}}', '{"v":1}']) {
      expect(parseLayout(raw)).toEqual(DEFAULT_LAYOUT);
    }
  });

  it("keeps valid pieces and defaults the rest", () => {
    const raw = JSON.stringify({
      v: 1,
      pieces: {
        scoreboard: { x: 0.1, y: 0.8, scale: 1.5 },
        round: { x: 2, y: 0.5, scale: 1 },
        timer: { x: 0.5, y: 0.5, scale: 9 },
        count: { x: "0.5", y: 0.5, scale: 1 },
        mystery: { x: 0.5, y: 0.5, scale: 1 },
      },
    });
    const layout = parseLayout(raw);
    expect(layout.scoreboard).toEqual({ x: 0.1, y: 0.8, scale: 1.5 });
    expect(layout.round).toEqual(DEFAULT_LAYOUT.round);
    expect(layout.timer).toEqual(DEFAULT_LAYOUT.timer);
    expect(layout.count).toEqual(DEFAULT_LAYOUT.count);
    expect(Object.keys(layout).sort()).toEqual([...PARTY_PIECES].sort());
  });

  it("round-trips through serializeLayout, storing only moved pieces", () => {
    const layout = { ...DEFAULT_LAYOUT, join: { x: 0.9, y: 0.1, scale: 2 } };
    const raw = serializeLayout(layout);
    expect(JSON.parse(raw)).toEqual({ v: 1, pieces: { join: { x: 0.9, y: 0.1, scale: 2 } } });
    expect(parseLayout(raw)).toEqual(layout);
    expect(JSON.parse(serializeLayout(DEFAULT_LAYOUT))).toEqual({ v: 1, pieces: {} });
  });
});

describe("movePlacement", () => {
  it("moves by fractions and keeps the anchor on screen", () => {
    expect(movePlacement({ x: 0.5, y: 0.5, scale: 1 }, 0.2, -0.1)).toEqual({ x: 0.7, y: 0.4, scale: 1 });
    expect(movePlacement({ x: 0.9, y: 0.1, scale: 2 }, 0.5, -0.5)).toEqual({ x: 1, y: 0, scale: 2 });
  });
});

describe("resizePlacement", () => {
  const anchor = { x: 100, y: 100 };
  const start = { x: 0.1, y: 0.1, scale: 1 };

  it("scales by the change in distance from the anchor", () => {
    expect(resizePlacement(start, anchor, { x: 200, y: 100 }, { x: 300, y: 100 }).scale).toBe(2);
    expect(resizePlacement({ ...start, scale: 2 }, anchor, { x: 100, y: 300 }, { x: 100, y: 200 }).scale).toBe(1);
  });

  it("clamps the scale", () => {
    expect(resizePlacement(start, anchor, { x: 110, y: 100 }, { x: 900, y: 100 }).scale).toBe(3);
    expect(resizePlacement(start, anchor, { x: 300, y: 100 }, { x: 101, y: 100 }).scale).toBe(0.4);
  });

  it("does nothing when the drag starts on the anchor", () => {
    expect(resizePlacement(start, anchor, { x: 101, y: 101 }, { x: 500, y: 500 })).toBe(start);
  });
});

describe("frameStyle", () => {
  it("puts a corner anchor at the point and scales from it", () => {
    expect(frameStyle({ x: 0.985, y: 0.09, scale: 1.5 }, { ax: 1, ay: 0 })).toEqual({
      left: "98.5%",
      top: "9%",
      transform: "translate(-100%, 0%) scale(1.5)",
      transformOrigin: "100% 0%",
    });
  });

  it("centres a centre anchor", () => {
    expect(frameStyle({ x: 0.5, y: 0.5, scale: 1 }, { ax: 0.5, ay: 0.5 })).toMatchObject({
      transform: "translate(-50%, -50%) scale(1)",
      transformOrigin: "50% 50%",
    });
  });
});

describe("layout settings", () => {
  it("defaults when nothing usable is saved", () => {
    for (const raw of [null, "", "not json", '{"v":1,"pieces":{}}']) expect(parseLayoutSettings(raw)).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps known hidden pieces and a valid choice style only", () => {
    const raw = JSON.stringify({ v: 1, pieces: {}, hidden: ["timer", "mystery", "choices"], choiceStyle: "row" });
    expect(parseLayoutSettings(raw)).toEqual({ hidden: ["timer", "choices"], choiceStyle: "row" });
    expect(parseLayoutSettings('{"hidden":"timer","choiceStyle":"diagonal"}')).toEqual(DEFAULT_SETTINGS);
  });

  it("round-trips, writing nothing extra for the defaults", () => {
    const settings = { hidden: ["join" as const], choiceStyle: "list" as const };
    expect(parseLayoutSettings(serializeLayout(DEFAULT_LAYOUT, settings))).toEqual(settings);
    expect(JSON.parse(serializeLayout(DEFAULT_LAYOUT, DEFAULT_SETTINGS))).toEqual({ v: 1, pieces: {} });
  });

  it("puts every piece in exactly one category", () => {
    const listed = PIECE_CATEGORIES.flatMap((category) => [...category.pieces]);
    expect([...listed].sort()).toEqual([...PARTY_PIECES].sort());
    expect(categoryOf("choices")).toBe("choices");
    expect(categoryOf("timer")).toBe("game");
  });
});
