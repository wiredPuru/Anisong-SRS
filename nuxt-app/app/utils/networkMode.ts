export type NetworkMode = boolean | null;

export const NETWORK_MODE_EVENT = "gaqSrs:networkModeChanged";

export function networkModeEndpoint(path: string): string {
  if (path === "/party/display") return "/api/party/display/network-mode";
  if (path === "/party/host") return "/api/party/host/network-mode";
  if (path === "/party/play") return "/api/party/player/network-mode";
  return "/api/network-mode";
}

export function parseNetworkMode(value: unknown): NetworkMode {
  if (typeof value !== "object" || value === null) return null;
  const offlineMode = (value as { offlineMode?: unknown }).offlineMode;
  return typeof offlineMode === "boolean" ? offlineMode : null;
}

export function networkModeChanged(previous: NetworkMode, next: NetworkMode): boolean {
  return previous !== null && next !== null && previous !== next;
}

function hasOfflineCode(value: unknown): boolean {
  return typeof value === "object" && value !== null && (value as { code?: unknown }).code === "OFFLINE_MODE";
}

// An H3 error carries the code on `data`; $fetch wraps the response body, so it sits one level deeper there.
export function isOfflineModeError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const data = (err as { data?: unknown }).data;
  if (hasOfflineCode(data)) return true;
  return typeof data === "object" && data !== null && hasOfflineCode((data as { data?: unknown }).data);
}
