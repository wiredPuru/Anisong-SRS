import { deleteManualDeck } from "../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.id !== "number") {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  const deleted = deleteManualDeck(body.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }

  return { success: true };
});
