import { PASSWORD_MIN_LENGTH, hashPassword, isLoopbackAddress } from "../../utils/partyAuth.ts";
import { setPartyPasswordHash } from "../../utils/partyHost.ts";
import { getPartyClientIp, partySessions, startPartySession } from "../../utils/partySession.ts";

// Only the host machine may set or replace the password, which also makes it
// the recovery path for a forgotten one.
export default defineEventHandler(async (event) => {
  if (!isLoopbackAddress(getPartyClientIp(event))) {
    throw createError({ statusCode: 403, statusMessage: "Set the host password on the host machine." });
  }

  const body = await readBody(event).catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createError({ statusCode: 400, statusMessage: `Use at least ${PASSWORD_MIN_LENGTH} characters.` });
  }

  setPartyPasswordHash(hashPassword(password));
  partySessions.revokeAll();
  startPartySession(event);
  return { ok: true };
});
