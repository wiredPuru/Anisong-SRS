import { getOfflineMode } from "../utils/mediaLibrary.ts";

export default defineEventHandler((event) => {
  if (event.method !== "GET" || !getHeader(event, "accept")?.includes("text/html") || !getOfflineMode()) return;
  setHeader(event, "content-security-policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; font-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'");
});
