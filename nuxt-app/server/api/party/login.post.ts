import { verifyPassword } from "../../utils/partyAuth.ts";
import { getPartyPasswordHash } from "../../utils/partyHost.ts";
import { getPartyClientIp, partyLoginLimiter, startPartySession } from "../../utils/partySession.ts";

export default defineEventHandler(async (event) => {
  const ip = getPartyClientIp(event) ?? "unknown";
  if (partyLoginLimiter.isBlocked(ip)) {
    throw createError({ statusCode: 429, statusMessage: "Too many attempts. Wait a minute and try again." });
  }

  const stored = getPartyPasswordHash();
  if (!stored) {
    throw createError({ statusCode: 409, statusMessage: "No host password is set yet." });
  }

  const body = await readBody(event).catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!verifyPassword(password, stored)) {
    partyLoginLimiter.recordFailure(ip);
    throw createError({ statusCode: 401, statusMessage: "Wrong password." });
  }

  partyLoginLimiter.reset(ip);
  startPartySession(event);
  return { ok: true };
});
