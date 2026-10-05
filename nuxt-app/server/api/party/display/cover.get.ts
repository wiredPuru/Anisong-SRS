import { readFileSync } from "node:fs";
import { resolveAnimeCover } from "../../../utils/animeCoverStore.ts";
import { findPartyItemByToken } from "../../../utils/partyStore.ts";
import { USER_AGENT } from "../../../utils/version.ts";

// Cover mode shows the answer's artwork, so, like clips, it reaches the
// display only by token and never as an AniList URL.
export default defineEventHandler(async (event) => {
  const token = getQuery(event).t;
  const item = typeof token === "string" ? findPartyItemByToken(token) : null;
  const url = item?.answer.coverImageUrl;
  if (!url) {
    throw createError({ statusCode: 404, statusMessage: "Cover not found" });
  }

  // The answer carries the SRS's own cover route when a copy is saved locally.
  // Read that file here instead, so the display still never sees a URL.
  const savedId = url.startsWith("/api/anime/cover?") ? Number(new URLSearchParams(url.split("?")[1]).get("id")) : null;
  const saved = savedId !== null && Number.isInteger(savedId) ? resolveAnimeCover(savedId) : null;
  if (saved?.kind === "file") {
    setResponseHeaders(event, { "Content-Type": saved.mime, "Cache-Control": "private, max-age=3600" });
    return new Uint8Array(readFileSync(saved.path));
  }
  const remoteUrl = saved?.kind === "remote" ? saved.url : url;

  let response: Response;
  try {
    response = await fetch(remoteUrl, { headers: { "User-Agent": USER_AGENT } });
  } catch {
    throw createError({ statusCode: 502, statusMessage: "The cover could not be loaded" });
  }
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) {
    throw createError({ statusCode: 502, statusMessage: "The cover could not be loaded" });
  }

  setResponseHeaders(event, { "Content-Type": type, "Cache-Control": "private, max-age=3600" });
  return new Uint8Array(await response.arrayBuffer());
});
