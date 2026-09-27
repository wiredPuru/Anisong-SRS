import { reportPartyPosition } from "../../../utils/partyStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => null);
  const { token, currentTime, duration, playing } = (body ?? {}) as Record<string, unknown>;
  const isTime = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (typeof token !== "string" || !isTime(currentTime) || typeof playing !== "boolean" || !(duration === null || isTime(duration))) {
    throw createError({ statusCode: 400, statusMessage: "Invalid position report" });
  }
  return { accepted: reportPartyPosition({ token, currentTime, duration, playing }) };
});
