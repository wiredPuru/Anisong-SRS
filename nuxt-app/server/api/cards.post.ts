import { createCard } from "../utils/cards.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (!body || typeof body.songId !== "number") {
    throw createError({ statusCode: 400, statusMessage: "songId is required and must be a number" });
  }

  const result = createCard({
    songId: body.songId,
    localVideoPath: body.localVideoPath,
    localAudioPath: body.localAudioPath,
    animethemesVideoUrl: body.animethemesVideoUrl,
    animethemesAudioUrl: body.animethemesAudioUrl,
  });

  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "Song not found" });
  }
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }

  return result;
});
