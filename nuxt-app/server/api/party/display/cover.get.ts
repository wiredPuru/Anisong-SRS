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

  let response: Response;
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
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
