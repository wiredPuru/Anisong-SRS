import { parseAudioFirstBody, setCardsAudioFirst } from "../../utils/cardAudioFirst.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseAudioFirstBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  return setCardsAudioFirst(parsed.ids, parsed.audioFirst);
});
