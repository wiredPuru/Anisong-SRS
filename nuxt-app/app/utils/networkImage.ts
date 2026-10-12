import type { NetworkMode } from "./networkMode.ts";

export function isLocalImage(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return false;
  return new URL(value, "http://local").origin === "http://local";
}

export function isSavedImage(value: string): boolean {
  if (value.startsWith("data:image/jpeg;base64,")) return true;
  if (!isLocalImage(value)) return false;
  const url = new URL(value, "http://local");
  return url.pathname === "/api/anime/cover" && /^[1-9]\d*$/.test(url.searchParams.get("id") ?? "");
}

export function networkImageSrc(value: string | null | undefined, offlineMode: NetworkMode): string | undefined {
  if (!value) return undefined;
  if (isLocalImage(value)) {
    const url = new URL(value, "http://local");
    const coverRoutes = ["/api/anime/cover", "/api/decks/image", "/api/party/display/cover", "/api/party/host/cover"];
    if (!coverRoutes.includes(url.pathname) && !url.pathname.startsWith("/mascot/") && !url.pathname.startsWith("/_nuxt/")) return undefined;
    if (offlineMode !== false && /\/cover$/.test(url.pathname)) {
      url.searchParams.set("localOnly", "1");
      return `${url.pathname}${url.search}`;
    }
    return value;
  }
  if (value.startsWith("data:image/jpeg;base64,")) return value;
  if (offlineMode !== false) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}
