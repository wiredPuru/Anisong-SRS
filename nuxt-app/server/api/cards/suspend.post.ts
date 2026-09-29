import { parseSuspendBody, setCardsSuspended } from "../../utils/cardSuspend.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseSuspendBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return setCardsSuspended(parsed.ids, parsed.suspended);
});
