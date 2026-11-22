import { readFileSync } from "node:fs";
import { createError, getQuery, setResponseHeaders, type H3Event } from "h3";
import { resolveAnimeCover } from "./animeCoverStore.ts";
import { findPartyItemByToken } from "./partyStore.ts";
import { USER_AGENT } from "./version.ts";
import { getOfflineMode } from "./mediaLibrary.ts";

export async function servePartyCover(event: H3Event): Promise<Uint8Array> {
  const token = getQuery(event).t;
  const item = typeof token === "string" ? findPartyItemByToken(token) : null;
  const url = item?.answer.coverImageUrl;
  if (!url) {
    throw createError({ statusCode: 404, statusMessage: "Cover not found" });
  }

  // A locally saved copy is read straight from disk.
  const savedId = url.startsWith("/api/anime/cover?") ? Number(new URLSearchParams(url.split("?")[1]).get("id")) : null;
  const saved = savedId !== null && Number.isInteger(savedId) ? resolveAnimeCover(savedId) : null;
  if (saved?.kind === "file") {
    setResponseHeaders(event, { "Content-Type": saved.mime, "Cache-Control": "private, max-age=3600" });
    return new Uint8Array(readFileSync(saved.path));
  }
  const remoteUrl = saved?.kind === "remote" ? saved.url : url;
  if (getOfflineMode() || getQuery(event).localOnly === "1") {
    throw createError({ statusCode: 404, statusMessage: "Cover not found" });
  }

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
}
