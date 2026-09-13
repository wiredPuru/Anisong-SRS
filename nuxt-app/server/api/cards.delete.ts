import { parseDeleteBody } from "../utils/cardDelete.ts";
import { deleteCard, deleteCards } from "../utils/cards.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseDeleteBody(await readBody(event));

  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  if (parsed.kind === "bulk") {
    return deleteCards(parsed.ids);
  }

  const deleted = deleteCard(parsed.id);
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }

  return { success: true };
});
