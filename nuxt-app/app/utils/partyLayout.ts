/** The party display's floating pieces the host can move and resize (feature 91b). */
export const PARTY_PIECES = ["reveal", "scoreboard", "round", "timer", "count", "join", "hints"] as const;
export type PartyPieceId = (typeof PARTY_PIECES)[number];

/** Where a piece's anchor sits, as fractions of the display, and its size. */
export interface PartyPlacement {
  x: number;
  y: number;
  scale: number;
}
/** The point of a piece that stays put: 0 is its left/top edge, 1 its right/bottom. */
export interface PartyAnchor {
  ax: 0 | 0.5 | 1;
  ay: 0 | 0.5 | 1;
}
export type PartyLayout = Record<PartyPieceId, PartyPlacement>;

export const LAYOUT_STORAGE_KEY = "gaqSrs:partyLayout";
const LAYOUT_VERSION = 1;
export const SCALE_MIN = 0.4;
export const SCALE_MAX = 3;
// Below this many pixels from the anchor, a resize has no direction to read.
const RESIZE_DEAD_ZONE_PX = 4;

export const PIECE_ANCHORS: Record<PartyPieceId, PartyAnchor> = {
  reveal: { ax: 0.5, ay: 1 },
  scoreboard: { ax: 1, ay: 0 },
  round: { ax: 0, ay: 0 },
  timer: { ax: 0, ay: 0 },
  count: { ax: 1, ay: 0 },
  join: { ax: 0, ay: 1 },
  hints: { ax: 0.5, ay: 0.5 },
};

// Approximates the fixed spots each piece had before it could move.
export const DEFAULT_LAYOUT: PartyLayout = {
  reveal: { x: 0.5, y: 0.96, scale: 1 },
  scoreboard: { x: 0.985, y: 0.09, scale: 1 },
  round: { x: 0.015, y: 0.16, scale: 1 },
  timer: { x: 0.015, y: 0.02, scale: 1 },
  count: { x: 0.985, y: 0.02, scale: 1 },
  join: { x: 0.015, y: 0.98, scale: 1 },
  hints: { x: 0.5, y: 0.5, scale: 1 },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function validPlacement(value: unknown): PartyPlacement | null {
  if (!value || typeof value !== "object") return null;
  const { x, y, scale } = value as Record<string, unknown>;
  const inRange = (n: unknown, min: number, max: number): n is number =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  return inRange(x, 0, 1) && inRange(y, 0, 1) && inRange(scale, SCALE_MIN, SCALE_MAX) ? { x, y, scale } : null;
}

/** A saved layout, piece by piece, with anything unreadable left at its default. */
export function parseLayout(raw: string | null): PartyLayout {
  const layout = { ...DEFAULT_LAYOUT };
  if (!raw) return layout;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return layout;
  }
  if (!parsed || typeof parsed !== "object") return layout;
  const { v, pieces } = parsed as { v?: unknown; pieces?: unknown };
  if (v !== LAYOUT_VERSION || !pieces || typeof pieces !== "object") return layout;
  for (const id of PARTY_PIECES) {
    const placement = validPlacement((pieces as Record<string, unknown>)[id]);
    if (placement) layout[id] = placement;
  }
  return layout;
}

const samePlacement = (a: PartyPlacement, b: PartyPlacement) => a.x === b.x && a.y === b.y && a.scale === b.scale;

/** Stores only the pieces moved from their default. */
export function serializeLayout(layout: PartyLayout): string {
  const pieces: Partial<PartyLayout> = {};
  for (const id of PARTY_PIECES) {
    if (!samePlacement(layout[id], DEFAULT_LAYOUT[id])) pieces[id] = layout[id];
  }
  return JSON.stringify({ v: LAYOUT_VERSION, pieces });
}

/** Moves the anchor by `dx`/`dy` fractions of the display, keeping it on screen. */
export function movePlacement(placement: PartyPlacement, dx: number, dy: number): PartyPlacement {
  return { ...placement, x: clamp(placement.x + dx, 0, 1), y: clamp(placement.y + dy, 0, 1) };
}

type Point = { x: number; y: number };
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Scales by how much farther from (or nearer to) the anchor the pointer is
 * than where the drag started. `start` is the placement when the drag began.
 */
export function resizePlacement(start: PartyPlacement, anchorPx: Point, startPointerPx: Point, pointerPx: Point): PartyPlacement {
  const from = distance(anchorPx, startPointerPx);
  if (from < RESIZE_DEAD_ZONE_PX) return start;
  const scale = clamp(start.scale * (distance(anchorPx, pointerPx) / from), SCALE_MIN, SCALE_MAX);
  return { ...start, scale };
}

/** CSS that puts the anchor at (x, y) and scales around it. */
export function frameStyle(placement: PartyPlacement, anchor: PartyAnchor): Record<string, string> {
  return {
    left: `${placement.x * 100}%`,
    top: `${placement.y * 100}%`,
    transform: `translate(${-anchor.ax * 100}%, ${-anchor.ay * 100}%) scale(${placement.scale})`,
    transformOrigin: `${anchor.ax * 100}% ${anchor.ay * 100}%`,
  };
}
