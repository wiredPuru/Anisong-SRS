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
