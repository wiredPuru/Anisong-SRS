// By-hand duplicate of server/utils/clipSource.ts's host mapping (F-09 - the
// server value is typed as Date-vs-string-different in other shapes, but here
// it's the client/server boundary itself: the player needs to know what's
// playable before it ever asks the server). Keep the host list identical to
// the server copy - a drift would make the player and the server disagree
// about what's allowed.
export const CLIP_SOURCES = ["anisongdb", "both", "animethemes"] as const;

export type ClipSource = (typeof CLIP_SOURCES)[number];

const PROVIDER_HOSTS: { domain: string; allowedBy: readonly ClipSource[] }[] = [
  { domain: "animemusicquiz.com", allowedBy: ["anisongdb", "both"] },
  { domain: "animethemes.moe", allowedBy: ["animethemes", "both"] },
];

export function isClipUrlAllowed(url: string, clipSource: ClipSource): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;

  const provider = PROVIDER_HOSTS.find(({ domain }) =>
    parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  return provider?.allowedBy.includes(clipSource) ?? false;
}

// Null-safe convenience wrapper - every caller here is checking a card's
// possibly-absent stored URL, not a value already known to exist.
export function isRemoteUrlAllowed(url: string | null, clipSource: ClipSource): boolean {
  return url !== null && isClipUrlAllowed(url, clipSource);
}
