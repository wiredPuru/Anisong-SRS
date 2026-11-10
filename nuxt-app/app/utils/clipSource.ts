// By-hand duplicate of server/utils/clipSource.ts's host mapping (F-09 - the
// server value is typed as Date-vs-string-different in other shapes, but here
// it's the client/server boundary itself: the player needs to know what's
// playable before it ever asks the server). Keep the host list identical to
// the server copy - a drift would make the player and the server disagree
// about what's allowed.
export const CLIP_SOURCES = ["anisongdb", "both", "animethemes"] as const;

export type ClipSource = (typeof CLIP_SOURCES)[number];

type RemoteProvider = "anisongdb" | "animethemes";

const PROVIDER_HOSTS: { domain: string; provider: RemoteProvider; allowedBy: readonly ClipSource[] }[] = [
  { domain: "animemusicquiz.com", provider: "anisongdb", allowedBy: ["anisongdb", "both"] },
  { domain: "animethemes.moe", provider: "animethemes", allowedBy: ["animethemes", "both"] },
];

function providerForUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:") return undefined;
  return PROVIDER_HOSTS.find(({ domain }) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
}

export function isClipUrlAllowed(url: string, clipSource: ClipSource): boolean {
  return providerForUrl(url)?.allowedBy.includes(clipSource) ?? false;
}

export type ClipOrigin = "library" | RemoteProvider;

// Where a clip loads from: a local file wins over a remote URL, as in the player.
export function clipOrigin(localPath: string | null, remoteUrl: string | null): ClipOrigin | null {
  if (localPath) return "library";
  return remoteUrl ? providerForUrl(remoteUrl)?.provider ?? null : null;
}

const ORIGIN_NAMES: Record<ClipOrigin, string> = {
  library: "your library",
  anisongdb: "AnisongDB",
  animethemes: "AnimeThemes.moe",
};

export function clipOriginName(origin: ClipOrigin): string {
  return ORIGIN_NAMES[origin];
}

// Null-safe convenience wrapper - every caller here is checking a card's
// possibly-absent stored URL, not a value already known to exist.
export function isRemoteUrlAllowed(url: string | null, clipSource: ClipSource): boolean {
  return url !== null && isClipUrlAllowed(url, clipSource);
}
