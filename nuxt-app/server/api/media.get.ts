import { existsSync, statSync } from "node:fs";
import { isPathWithinLibrary } from "../utils/mediaLibrary.ts";
import { getMimeType, serveRangedFile } from "../utils/rangedFile.ts";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const path = typeof query.path === "string" ? query.path : "";

  if (!path) {
    throw createError({ statusCode: 400, statusMessage: "path is required" });
  }

  if (!existsSync(path) || !statSync(path).isFile() || !isPathWithinLibrary(path)) {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }

  return serveRangedFile(event, path, getMimeType(path));
});
