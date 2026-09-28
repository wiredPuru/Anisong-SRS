import { parseUndoBody, undoReview } from "../../utils/studyUndo.ts";

export default defineEventHandler(async (event) => {
  const parsed = parseUndoBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }

  const result = undoReview(parsed.reviewLogId);
  if ("notFound" in result) {
    throw createError({ statusCode: 404, statusMessage: "That review no longer exists" });
  }
  if ("conflict" in result) {
    throw createError({ statusCode: 409, statusMessage: result.conflict });
  }

  return result;
});
