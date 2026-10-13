import { CENSOR_MIN_SIZE, parsePartyCensor, type PartyCensorBox, type PartyCensorStyle } from "./partyCensor.ts";

/** A box over every video clip's picture, for burned-in title cards the host never has to draw per song. */
export interface PartyCreditsGuard {
  enabled: boolean;
  box: PartyCensorBox;
  style: PartyCensorStyle;
}

// Animethemes.moe's credits box sits bottom-left.
export const DEFAULT_CREDITS_GUARD: PartyCreditsGuard = {
  enabled: false,
  box: { x: 0.02, y: 0.76, w: 0.5, h: 0.2 },
  style: "black",
};

export const DEFAULT_START_FLOOR = 10;
export const START_FLOOR_MAX = 60;

export function clampStartFloor(seconds: number): number {
  return Math.round(Math.min(START_FLOOR_MAX, Math.max(0, seconds)));
}

/** A guard from a command or a saved row; a wrong shape is an error, never a silent default. */
export function parseCreditsGuard(raw: unknown): PartyCreditsGuard | { error: string } {
  if (typeof raw !== "object" || raw === null) return { error: "creditsGuard must be an object" };
  const { enabled, box, style } = raw as Record<string, unknown>;
  if (typeof enabled !== "boolean") return { error: "enabled must be a boolean" };
  const parsed = parsePartyCensor({ boxes: [box], style, muted: false });
  if (parsed === null || "error" in parsed) return { error: parsed === null ? "box is missing" : parsed.error };
  const [checked] = parsed.boxes;
  if (!checked || checked.w < CENSOR_MIN_SIZE) return { error: "box is too small" };
  return { enabled, box: checked, style: parsed.style };
}

/** Saved settings as stored; anything unreadable falls back to the defaults. */
export function parseSavedGuard(json: string): { startFloor: number; creditsGuard: PartyCreditsGuard } {
  const fallback = { startFloor: DEFAULT_START_FLOOR, creditsGuard: DEFAULT_CREDITS_GUARD };
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const guard = parseCreditsGuard(raw.creditsGuard);
    return {
      startFloor: typeof raw.startFloor === "number" && Number.isFinite(raw.startFloor) ? clampStartFloor(raw.startFloor) : DEFAULT_START_FLOOR,
      creditsGuard: "error" in guard ? DEFAULT_CREDITS_GUARD : guard,
    };
  } catch {
    return fallback;
  }
}
