import { parseRecoverBody, type RecoverResult } from "../../utils/libraryScan.ts";
import { applyLibraryScan } from "../../utils/libraryScanLoad.ts";

export default defineEventHandler(async (event): Promise<RecoverResult> => {
  const parsed = parseRecoverBody(await readBody(event));
  if ("error" in parsed) {
    throw createError({ statusCode: 400, statusMessage: parsed.error });
  }
  try {
    return applyLibraryScan(parsed.paths);
  } catch {
    throw createError({ statusCode: 500, statusMessage: "Couldn't add cards from the library files." });
  }
});
