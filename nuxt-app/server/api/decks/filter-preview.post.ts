import { listFilteredAnime } from "../../utils/deckFilterPreview.ts";
import { parseStudyFilters } from "../../utils/studyFilters.ts";

// POST although read-only: a user-list filter can carry up to 5000 AniList
// ids, too long for a query string.
export default defineEventHandler(async (event) => {
  const body: unknown = await readBody(event);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw createError({ statusCode: 400, statusMessage: "Body must be a JSON object" });
  }

  const parsed = parseStudyFilters((body as { filters?: unknown }).filters);
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  return listFilteredAnime(parsed.filters);
});
