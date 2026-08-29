import { parseStudyScope } from "../../utils/cards.ts";
import { setScopeMode } from "../../utils/studyScopeSettings.ts";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  if (body?.mode !== "auto" && body?.mode !== "audioOnly" && body?.mode !== "videoOnly") {
    throw createError({ statusCode: 400, statusMessage: "mode must be 'auto', 'audioOnly', or 'videoOnly'" });
  }

  const result = parseStudyScope(body.type, body.id !== undefined ? String(body.id) : undefined);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }
  if ("notFound" in result) {
    throw createError({
      statusCode: 404,
      statusMessage: body.type === "artist" ? "Artist not found" : "Anime not found",
    });
  }

  return { mode: setScopeMode(result.scope, body.mode) };
});
