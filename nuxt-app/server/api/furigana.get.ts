import { toFuriganaHtml } from "../utils/furigana.ts";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const text = typeof query.text === "string" ? query.text : "";

  if (!text) {
    throw createError({ statusCode: 400, statusMessage: "text is required" });
  }

  const html = await toFuriganaHtml(text);
  return { html };
});
