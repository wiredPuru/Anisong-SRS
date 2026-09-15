export const CLIP_SOURCES = ["anisongdb", "both", "animethemes"] as const;

export type ClipSource = (typeof CLIP_SOURCES)[number];

// Which setting values let each provider's hosts serve clip files. AnisongDB's
// clips live on AMQ's distribution hosts, not on anisongdb.com itself.
const PROVIDER_HOSTS: { domain: string; allowedBy: readonly ClipSource[] }[] = [
  { domain: "animemusicquiz.com", allowedBy: ["anisongdb", "both"] },
  { domain: "animethemes.moe", allowedBy: ["animethemes", "both"] },
];

export function isClipSource(value: unknown): value is ClipSource {
  return typeof value === "string" && (CLIP_SOURCES as readonly string[]).includes(value);
}

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

export interface FilteredClipUrls {
  videoUrl: string | null;
  audioUrl: string | null;
  // True only when a URL existed and the setting rejected all of it - not
  // when the provider simply never had a clip here to begin with.
  clipBlocked: boolean;
}

export function filterClipUrls(
  videoUrl: string | null,
  audioUrl: string | null,
  clipSource: ClipSource,
): FilteredClipUrls {
  // Normalize undefined to null too - some upstream shapes (loosely-typed
  // provider responses, test doubles) don't always set these fields
  // explicitly even though the real type contract promises string | null.
  const rawVideo = videoUrl ?? null;
  const rawAudio = audioUrl ?? null;
  const allowedVideo = rawVideo !== null && isClipUrlAllowed(rawVideo, clipSource) ? rawVideo : null;
  const allowedAudio = rawAudio !== null && isClipUrlAllowed(rawAudio, clipSource) ? rawAudio : null;
  const hadSomething = rawVideo !== null || rawAudio !== null;

  return {
    videoUrl: allowedVideo,
    audioUrl: allowedAudio,
    clipBlocked: hadSomething && allowedVideo === null && allowedAudio === null,
  };
}
