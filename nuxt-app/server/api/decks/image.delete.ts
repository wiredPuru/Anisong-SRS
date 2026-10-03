import { removeDeckImage } from "../../utils/deckImageStore.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.id !== "number") {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  const result = removeDeckImage(body.id);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }
  return result;
});
