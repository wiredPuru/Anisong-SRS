import { createManualDeck } from "../utils/decks.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.name !== "string") {
    throw createError({ statusCode: 400, statusMessage: "name is required and must be a string" });
  }

  const result = createManualDeck(body.name);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
