import { parseKnownBody, setCardsKnown } from "../../utils/cardKnown.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseKnownBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return setCardsKnown(parsed.ids, parsed.known);
});
