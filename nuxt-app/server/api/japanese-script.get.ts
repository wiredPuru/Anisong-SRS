import { isKanaTarget, toKanaText } from "../utils/furigana.ts";

const MAX_TEXT = 200;

export default defineEventHandler(async (event) => {
  const { text, to } = getQuery(event);
  if (typeof text !== "string" || !text.trim()) {
    throw createError({ statusCode: 400, statusMessage: "text is required" });
  }
  if (text.length > MAX_TEXT) {
    throw createError({ statusCode: 400, statusMessage: `text must be at most ${MAX_TEXT} characters` });
  }
  if (!isKanaTarget(to)) {
    throw createError({ statusCode: 400, statusMessage: "to must be hiragana or katakana" });
  }
  return { text: await toKanaText(text, to) };
});
