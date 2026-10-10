import type { PartyCensorBox } from "~/composables/usePartyDisplay";

export const CENSOR_MAX_BOXES = 6;
export const CENSOR_MIN_SIZE = 0.02;
export const FULL_FRAME: PartyCensorBox = { x: 0, y: 0, w: 1, h: 1 };

export interface Point {
  x: number;
  y: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The box dragged out between two points, in either direction; null when too small to mean one. */
export function boxFromDrag(start: Point, end: Point): PartyCensorBox | null {
  const x1 = clamp01(Math.min(start.x, end.x));
  const y1 = clamp01(Math.min(start.y, end.y));
  const x2 = clamp01(Math.max(start.x, end.x));
  const y2 = clamp01(Math.max(start.y, end.y));
  if (x2 - x1 < CENSOR_MIN_SIZE || y2 - y1 < CENSOR_MIN_SIZE) return null;
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Moves a box by a fraction of the picture, stopping at its edges. */
export function moveBox(box: PartyCensorBox, dx: number, dy: number): PartyCensorBox {
  return {
    ...box,
    x: Math.min(1 - box.w, Math.max(0, box.x + dx)),
    y: Math.min(1 - box.h, Math.max(0, box.y + dy)),
  };
}

/** Drags a box's bottom-right corner, keeping it inside the picture and above the minimum size. */
export function resizeBox(box: PartyCensorBox, dx: number, dy: number): PartyCensorBox {
  return {
    ...box,
    w: Math.min(1 - box.x, Math.max(CENSOR_MIN_SIZE, box.w + dx)),
    h: Math.min(1 - box.y, Math.max(CENSOR_MIN_SIZE, box.h + dy)),
  };
}

/** A point within an element, as fractions of its size. */
export function pointIn(rect: { left: number; top: number; width: number; height: number }, clientX: number, clientY: number): Point {
  return {
    x: rect.width ? (clientX - rect.left) / rect.width : 0,
    y: rect.height ? (clientY - rect.top) / rect.height : 0,
  };
}
