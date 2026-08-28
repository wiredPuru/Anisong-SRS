import { deleteCard } from "../utils/cards.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.id !== "number") {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  const deleted = deleteCard(body.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }

  return { success: true };
});
