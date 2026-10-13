import { describe, expect, it } from "vitest";
import { dragGuardBox } from "./partyGuardBox";

const original = { x: 0.1, y: 0.5, w: 0.3, h: 0.2 };

describe("dragGuardBox", () => {
  it("moves by the pointer distance", () => {
    const moved = dragGuardBox({ mode: "move", startX: 0.2, startY: 0.6, original }, 0.3, 0.7);
    expect(moved.x).toBeCloseTo(0.2);
    expect(moved.y).toBeCloseTo(0.6);
    expect(moved).toMatchObject({ w: 0.3, h: 0.2 });
  });

  it("stops a move at the picture edge", () => {
    expect(dragGuardBox({ mode: "move", startX: 0, startY: 0, original }, 5, 5)).toEqual({ x: 0.7, y: 0.8, w: 0.3, h: 0.2 });
  });

  it("resizes from the bottom-right corner and keeps a minimum size", () => {
    const resized = dragGuardBox({ mode: "resize", startX: 0, startY: 0, original }, 0.1, 0.1);
    expect(resized.w).toBeCloseTo(0.4);
    expect(resized.h).toBeCloseTo(0.3);
    expect(dragGuardBox({ mode: "resize", startX: 0, startY: 0, original }, -5, -5)).toMatchObject({ w: 0.02, h: 0.02 });
  });
});
