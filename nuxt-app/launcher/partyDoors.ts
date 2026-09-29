export type Door = "display" | "control" | "player";

export type DoorDecision =
  | { kind: "proxy" }
  | { kind: "redirect"; location: string }
  | { kind: "notFound" };

export const DOOR_HOME: Record<Door, string> = {
  display: "/party/display",
  control: "/party/host",
  player: "/party/play",
};

const SHARED_ASSETS = ["/_nuxt/", "/mascot/"];
const SHARED_FILES = new Set(["/favicon.ico", "/apple-touch-icon.png", "/party-unlock.mp4"]);

function isSharedAsset(path: string): boolean {
  return SHARED_FILES.has(path) || SHARED_ASSETS.some((prefix) => path.startsWith(prefix));
}

/**
 * The front door's own allowlist, a first gate ahead of the app's party
 * middleware: anything not listed never reaches the SRS routes behind it.
 */
export function decideDoorRequest(door: Door, path: string): DoorDecision {
  if (path === "/" || path === "") return { kind: "redirect", location: DOOR_HOME[door] };
  if (isSharedAsset(path)) return { kind: "proxy" };

  if (door === "display") {
    return path === "/party/display" || path.startsWith("/api/party/display/")
      ? { kind: "proxy" }
      : { kind: "notFound" };
  }

  if (door === "player") {
    return path === "/party/play" || path.startsWith("/api/party/player/")
      ? { kind: "proxy" }
      : { kind: "notFound" };
  }

  if (path === "/party/host") return { kind: "proxy" };
  const otherDoorsApi = path.startsWith("/api/party/display/") || path.startsWith("/api/party/player/");
  if (path.startsWith("/api/party/") && !otherDoorsApi) return { kind: "proxy" };
  return { kind: "notFound" };
}

/** Every non-internal IPv4 address, for the LAN control URLs. */
export function lanAddresses(
  interfaces: Record<string, Array<{ address: string; family: string | number; internal: boolean }> | undefined>,
): string[] {
  const found = new Set<string>();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      const isIpv4 = entry.family === "IPv4" || entry.family === 4;
      if (isIpv4 && !entry.internal) found.add(entry.address);
    }
  }
  return [...found];
}
