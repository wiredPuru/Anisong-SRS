import type { LibraryScanResponse } from "../../utils/libraryScan.ts";
import { loadLibraryScan } from "../../utils/libraryScanLoad.ts";

export default defineEventHandler((): LibraryScanResponse => {
  try {
    return loadLibraryScan();
  } catch {
    throw createError({ statusCode: 500, statusMessage: "Couldn't scan the library folders." });
  }
});
