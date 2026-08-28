import { createReadStream, existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { isPathWithinLibrary } from "../utils/mediaLibrary.ts";

const MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
};

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const path = typeof query.path === "string" ? query.path : "";

  if (!path) {
    throw createError({ statusCode: 400, statusMessage: "path is required" });
  }

  if (!existsSync(path) || !statSync(path).isFile() || !isPathWithinLibrary(path)) {
    throw createError({ statusCode: 404, statusMessage: "File not found" });
  }

  const fileSize = statSync(path).size;
  const rangeHeader = getRequestHeader(event, "range");

  setResponseHeader(event, "accept-ranges", "bytes");
  setResponseHeader(event, "content-type", getMimeType(path));

  if (!rangeHeader) {
    setResponseHeader(event, "content-length", fileSize);
    return sendStream(event, createReadStream(path));
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  const [, startRaw, endRaw] = match ?? [];

  if (!match || (startRaw === "" && endRaw === "")) {
    throw createError({ statusCode: 416, statusMessage: "Range Not Satisfiable" });
  }

  let start: number;
  let end: number;

  if (startRaw === "") {
    // suffix range, e.g. "bytes=-500" -> the last 500 bytes
    const suffixLength = Number(endRaw);
    start = Math.max(fileSize - suffixLength, 0);
    end = fileSize - 1;
  } else {
    start = Number(startRaw);
    end = endRaw === "" ? fileSize - 1 : Number(endRaw);
  }

  if (start > end || start < 0 || end >= fileSize) {
    throw createError({ statusCode: 416, statusMessage: "Range Not Satisfiable" });
  }

  setResponseStatus(event, 206);
  setResponseHeader(event, "content-range", `bytes ${start}-${end}/${fileSize}`);
  setResponseHeader(event, "content-length", end - start + 1);

  return sendStream(event, createReadStream(path, { start, end }));
});
