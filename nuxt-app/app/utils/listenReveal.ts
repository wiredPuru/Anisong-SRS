export type AutoRevealMode = "off" | "info" | "both";

export const AUTO_REVEAL_SECONDS_DEFAULT = 5;
const AUTO_REVEAL_SECONDS_MIN = 1;
const AUTO_REVEAL_SECONDS_MAX = 30;

const AUTO_REVEAL_MODES: readonly string[] = ["off", "info", "both"];

export function isAutoRevealMode(value: string | null): value is AutoRevealMode {
  return value !== null && AUTO_REVEAL_MODES.includes(value);
}

/** A stored mode; the retired "video" choice hid the picture, which "both" now does too. */
export function readStoredAutoRevealMode(value: string | null): AutoRevealMode {
  if (value === "video") return "both";
  return isAutoRevealMode(value) ? value : "off";
}

export function clampRevealSeconds(value: number): number {
  if (!Number.isFinite(value)) return AUTO_REVEAL_SECONDS_DEFAULT;
  return Math.min(AUTO_REVEAL_SECONDS_MAX, Math.max(AUTO_REVEAL_SECONDS_MIN, Math.round(value)));
}

/** "Visual" is whichever of Hide Video and Hide Cover applies to the song. */
export function revealTargets(mode: AutoRevealMode): { visual: boolean; info: boolean } {
  return { visual: mode === "both", info: mode === "info" || mode === "both" };
}
