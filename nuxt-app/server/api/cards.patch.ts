import { updateCard } from "../utils/cards.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.id !== "number") {
    throw createError({ statusCode: 400, statusMessage: "id is required and must be a number" });
  }

  const result = updateCard({
    id: body.id,
    localVideoPath: body.localVideoPath,
    localAudioPath: body.localAudioPath,
    songTitle: body.songTitle,
    themeSlot: body.themeSlot,
    artistMode: body.artistMode,
    artistName: body.artistName,
  });

  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Card not found" });
  }
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
