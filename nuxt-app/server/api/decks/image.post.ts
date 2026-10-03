import { saveDeckImage } from "../../utils/deckImageStore.ts";

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event);
  const deckId = Number(parts?.find((part) => part.name === "deckId")?.data.toString("utf8"));
  const file = parts?.find((part) => part.name === "file");

  if (!Number.isInteger(deckId) || deckId < 1) {
    throw createError({ statusCode: 400, statusMessage: "deckId is required and must be a positive integer" });
  }
  if (!file || file.data.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "file is required" });
  }

  const result = saveDeckImage(deckId, file.data);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Deck not found" });
  }
  if ("error" in result) {
    throw createError(
      result.error === "too-large"
        ? { statusCode: 413, statusMessage: "Picture is over the 5 MB limit" }
        : { statusCode: 415, statusMessage: "Picture must be a PNG, JPEG or WebP file" },
    );
  }
  return result;
});
