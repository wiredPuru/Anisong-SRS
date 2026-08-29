import { parseStudyScope } from "../../utils/cards.ts";
import { getScopeMode } from "../../utils/studyScopeSettings.ts";

export default defineEventHandler((event) => {
  const { type, id } = getQuery(event);

  const result = parseStudyScope(type, id);
  if ("error" in result) {
    throw createError({ statusCode: 400, statusMessage: result.error });
  }
  if ("notFound" in result) {
    throw createError({
      statusCode: 404,
      statusMessage: type === "artist" ? "Artist not found" : "Anime not found",
    });
  }

  return { mode: getScopeMode(result.scope) };
});
