import { describe, expect, it } from "vitest";
import { boxFromDrag, censorAt, moveBox, pointIn, resizeBox } from "./partyCensorBoxes";

describe("boxFromDrag", () => {
  it("builds a box dragged in any direction", () => {
    expect(boxFromDrag({ x: 0.6, y: 0.7 }, { x: 0.2, y: 0.3 })).toEqual({ x: 0.2, y: 0.3, w: expect.closeTo(0.4), h: expect.closeTo(0.4) });
  });

  it("clips a drag that leaves the picture", () => {
    expect(boxFromDrag({ x: 0.5, y: 0.5 }, { x: 1.4, y: -0.2 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });

  it("ignores a click with no real drag", () => {
    expect(boxFromDrag({ x: 0.5, y: 0.5 }, { x: 0.505, y: 0.6 })).toBeNull();
  });
});

describe("moveBox", () => {
  it("stops at the picture's edges", () => {
    const box = { x: 0.1, y: 0.1, w: 0.4, h: 0.4 };
    expect(moveBox(box, 0.2, 0.1)).toEqual({ x: expect.closeTo(0.3), y: expect.closeTo(0.2), w: 0.4, h: 0.4 });
    expect(moveBox(box, 0.9, -0.5)).toEqual({ x: 0.6, y: 0, w: 0.4, h: 0.4 });
  });
});

describe("resizeBox", () => {
  it("grows to the edge and shrinks to the minimum", () => {
    const box = { x: 0.5, y: 0.5, w: 0.2, h: 0.2 };
    expect(resizeBox(box, 0.9, 0.9)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
    expect(resizeBox(box, -0.5, -0.5)).toEqual({ x: 0.5, y: 0.5, w: 0.02, h: 0.02 });
  });
});

describe("pointIn", () => {
  it("turns a client point into fractions of the element", () => {
    expect(pointIn({ left: 100, top: 50, width: 200, height: 100 }, 150, 100)).toEqual({ x: 0.25, y: 0.5 });
  });
});

describe("censorAt", () => {
  it("follows a saved track by clip time", () => {
    const censor = { boxes: [{ x: 0, y: 0, w: 1, h: 1 }], style: "blur" as const, muted: true };
    const track = [{ at: 5, censor }, { at: 9, censor: null }];
    expect(censorAt(track, 4)).toBeNull();
    expect(censorAt(track, 6)).toEqual(censor);
    expect(censorAt(track, 9)).toBeNull();
    expect(censorAt(null, 6)).toBeNull();
  });
});
