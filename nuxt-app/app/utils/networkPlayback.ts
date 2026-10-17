import type { NetworkMode } from "./networkMode.ts";

export function networkMediaKind(options: {
  offlineMode: NetworkMode;
  audioOnly: boolean;
  audioFallback: boolean;
  localVideo: boolean;
  localAudio: boolean;
  hasVideo: boolean;
  hasAudio: boolean;
}): "video" | "audio" {
  const prefersAudio = options.audioOnly || options.audioFallback;
  if (options.offlineMode !== false) {
    if (prefersAudio && options.localAudio) return "audio";
    if (options.localVideo) return "video";
    if (options.localAudio) return "audio";
  }
  if (prefersAudio && options.hasAudio) return "audio";
  return options.hasVideo ? "video" : "audio";
}

export const OFFLINE_CLIP_MESSAGE = "This clip isn't downloaded, and Offline mode is on.";

// Offline, the stream route only ever serves a complete cached copy, so a
// stream URL that fails to load is a clip that isn't saved here.
export function isOfflineUncachedFailure(offlineMode: NetworkMode, failedSrc: string | null | undefined): boolean {
  return offlineMode === true && Boolean(failedSrc) && new URL(failedSrc!, "http://localhost").pathname === "/api/media/stream";
}
