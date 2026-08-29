import { renameManualDeck } from "../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.id !== "number") {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }
  if (typeof body.name !== "string") {
    throw createError({ statusCode: 400, statusMessage: "name is required and must be a string" });
  }

  const result = renameManualDeck(body.id, body.name);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
