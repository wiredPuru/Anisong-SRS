/** A region of the picture to hide, as fractions of the clip's own width and height. */
export interface PartyCensorBox {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type PartyCensorStyle = "blur" | "black";
export interface PartyCensor {
  boxes: PartyCensorBox[];
  style: PartyCensorStyle;
  muted: boolean;
}

export const CENSOR_MAX_BOXES = 6;
export const CENSOR_MIN_SIZE = 0.02;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const round = (value: number) => Math.round(value * 10000) / 10000;

function parseBox(raw: unknown): PartyCensorBox | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { x, y, w, h } = raw as Record<string, unknown>;
  if (!isNumber(x) || !isNumber(y) || !isNumber(w) || !isNumber(h)) return null;
  // Kept inside the picture and never thinner than a sliver.
  const width = clamp(w, CENSOR_MIN_SIZE, 1);
  const height = clamp(h, CENSOR_MIN_SIZE, 1);
  return {
    x: round(clamp(x, 0, 1 - width)),
    y: round(clamp(y, 0, 1 - height)),
    w: round(width),
    h: round(height),
  };
}

/** A censor with nothing to hide and nothing to mute is no censor: null. */
export function parsePartyCensor(raw: unknown): PartyCensor | null | { error: string } {
  if (raw === null) return null;
  if (typeof raw !== "object") return { error: "censor must be an object or null" };
  const { boxes, style, muted } = raw as Record<string, unknown>;
  if (!Array.isArray(boxes) || boxes.length > CENSOR_MAX_BOXES) return { error: `boxes must hold 0-${CENSOR_MAX_BOXES} boxes` };
  if (style !== "blur" && style !== "black") return { error: "style must be 'blur' or 'black'" };
  if (typeof muted !== "boolean") return { error: "muted must be a boolean" };
  const parsed = boxes.map(parseBox);
  if (parsed.some((box) => box === null)) return { error: "each box needs numeric x, y, w, and h" };
  if (!parsed.length && !muted) return null;
  return { boxes: parsed as PartyCensorBox[], style, muted };
}
