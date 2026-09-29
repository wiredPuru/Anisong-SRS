import type { PartyPosition } from "./partyGame.ts";

export function parsePartyPosition(input: unknown): PartyPosition | null {
  if (!input || typeof input !== "object") return null;
  const { token, currentTime, duration, playing, blocked, elapsed } = input as Record<string, unknown>;
  const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (typeof token !== "string" || !isTime(currentTime) || !(duration === null || isTime(duration))
    || typeof playing !== "boolean" || typeof blocked !== "boolean"
    || typeof elapsed !== "number" || !Number.isFinite(elapsed)) return null;
  return { token, currentTime, duration, playing, blocked, elapsed: Math.max(0, elapsed) };
}
