import { isLocalAnswerKind, searchLocalAnswers } from "../../utils/localAnswerSearch.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const q = typeof query.q === "string" ? query.q.trim() : "";
  if (!q) {
    throw createError({ statusCode: 400, statusMessage: "q is required" });
  }
  if (!isLocalAnswerKind(query.kind)) {
    throw createError({ statusCode: 400, statusMessage: "kind must be anime, artist, or song" });
  }
  return { results: searchLocalAnswers(query.kind, q) };
});
