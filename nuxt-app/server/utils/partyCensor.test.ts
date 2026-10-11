import { describe, expect, it } from "vitest";
import { CENSOR_MAX_BOXES, censorAt, parseCensorTrack, parsePartyCensor, recordCensorKey } from "./partyCensor.ts";

describe("parsePartyCensor", () => {
  it("passes null through as no censor", () => {
    expect(parsePartyCensor(null)).toBeNull();
  });

  it("keeps a valid censor", () => {
    expect(parsePartyCensor({ boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }], style: "blur", muted: false })).toEqual({
      boxes: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.4 }],
      style: "blur",
      muted: false,
    });
  });

  it("pulls a box back inside the picture and widens a sliver", () => {
    const parsed = parsePartyCensor({ boxes: [{ x: 0.9, y: -0.5, w: 0.3, h: 0 }], style: "black", muted: false });
    expect(parsed).toEqual({ boxes: [{ x: 0.7, y: 0, w: 0.3, h: 0.02 }], style: "black", muted: false });
  });

  it("treats no boxes and no mute as no censor, but keeps a mute-only one", () => {
    expect(parsePartyCensor({ boxes: [], style: "black", muted: false })).toBeNull();
    expect(parsePartyCensor({ boxes: [], style: "black", muted: true })).toEqual({ boxes: [], style: "black", muted: true });
  });

  it("rejects bad input", () => {
    expect(parsePartyCensor("x")).toHaveProperty("error");
    expect(parsePartyCensor({ boxes: [], style: "pink", muted: true })).toHaveProperty("error");
    expect(parsePartyCensor({ boxes: [{ x: "a", y: 0, w: 1, h: 1 }], style: "blur", muted: false })).toHaveProperty("error");
    const tooMany = Array.from({ length: CENSOR_MAX_BOXES + 1 }, () => ({ x: 0, y: 0, w: 0.1, h: 0.1 }));
    expect(parsePartyCensor({ boxes: tooMany, style: "blur", muted: false })).toHaveProperty("error");
  });
});

describe("censor tracks", () => {
  const box = { boxes: [{ x: 0, y: 0, w: 1, h: 1 }], style: "black" as const, muted: false };

  it("keeps changes in time order and merges ones made moments apart", () => {
    let track = recordCensorKey([], 10, box);
    track = recordCensorKey(track, 4, null);
    track = recordCensorKey(track, 10.3, { ...box, style: "blur" });
    expect(track).toEqual([{ at: 4, censor: null }, { at: 10.3, censor: { ...box, style: "blur" } }]);
  });

  it("finds the censor in force at a time", () => {
    const track = [{ at: 5, censor: box }, { at: 9, censor: null }];
    expect(censorAt(track, 2)).toBeNull();
    expect(censorAt(track, 5)).toEqual(box);
    expect(censorAt(track, 8.9)).toEqual(box);
    expect(censorAt(track, 12)).toBeNull();
  });

  it("reads back a stored track and drops bad entries", () => {
    expect(parseCensorTrack([{ at: 9, censor: null }, { at: -1, censor: null }, { at: 3, censor: box }, "x"])).toEqual([
      { at: 3, censor: box },
      { at: 9, censor: null },
    ]);
    expect(parseCensorTrack("nope")).toEqual([]);
  });
});
