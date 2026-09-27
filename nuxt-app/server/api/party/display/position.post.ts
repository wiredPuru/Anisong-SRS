import { reportPartyPosition } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const { token, currentTime, duration, playing, elapsed } = (body ?? {}) as Record<string, unknown>;
  const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const isElapsed = typeof elapsed === "number" && Number.isFinite(elapsed);
  if (typeof token !== "string" || !isTime(currentTime) || typeof playing !== "boolean" || !(duration === null || isTime(duration)) || !isElapsed) {
    throw createError({ statusCode: 400, statusMessage: "Invalid position report" });
  }
  return { accepted: reportPartyPosition({ token, currentTime, duration, playing, elapsed: Math.max(0, elapsed as number) }) };
});
