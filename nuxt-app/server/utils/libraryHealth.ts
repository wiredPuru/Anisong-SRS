import { isAbsolute, relative } from "node:path";
import type { CardWithDetails } from "./cards.ts";
import { isAnimethemesUrl, isClipUrlAllowed, type ClipSource } from "./clipSource.ts";

export type LocalFileState = "ok" | "missing" | "outsideLibrary";
export type MediaKind = "video" | "audio";

export interface CardHealth {
  localIssues: { kind: MediaKind; problem: "missing" | "outsideLibrary"; path: string }[];
  noPlayableSource: boolean;
  redownload: MediaKind[];
  clear: MediaKind[];
  resource: boolean;
}

export interface CardHealthRow {
  card: CardWithDetails;
  health: CardHealth;
}

export interface LibraryHealthResponse {
  checked: number;
  clipSource: ClipSource;
  hasDefaultDownloadFolder: boolean;
  issues: CardHealthRow[];
}

export interface CardHealthInput {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
  videoState: LocalFileState | null;
  audioState: LocalFileState | null;
  clipSource: ClipSource;
  hasDefaultDownloadFolder: boolean;
}

// The same membership rule as isPathWithinLibrary, against a folder list the
// caller read once, since /api/media refuses a path outside every folder.
export function localFileState(path: string, libraryPaths: readonly string[], isFile: (path: string) => boolean): LocalFileState {
  const inside = libraryPaths.some((libraryPath) => {
    const rel = relative(libraryPath, path);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
  });
  if (!inside) return "outsideLibrary";
  return isFile(path) ? "ok" : "missing";
}

export function classifyCardHealth(input: CardHealthInput): CardHealth {
  const kinds = [
    { kind: "video" as const, local: input.localVideoPath, remote: input.animethemesVideoUrl, state: input.videoState },
    { kind: "audio" as const, local: input.localAudioPath, remote: input.animethemesAudioUrl, state: input.audioState },
  ];
  const sourceCount = kinds.reduce((count, k) => count + (k.local ? 1 : 0) + (k.remote ? 1 : 0), 0);
  const allowed = (url: string | null) => url !== null && isClipUrlAllowed(url, input.clipSource);

  const localIssues: CardHealth["localIssues"] = [];
  for (const k of kinds) {
    if (k.local && (k.state === "missing" || k.state === "outsideLibrary")) {
      localIssues.push({ kind: k.kind, problem: k.state, path: k.local });
    }
  }

  // Only a missing file is offered Clear or Re-download: clearing a path also
  // deletes its file, and an outside-library file still exists.
  const missing = kinds.filter((k) => k.local && k.state === "missing");

  return {
    localIssues,
    noPlayableSource: !kinds.some((k) => (k.local && k.state === "ok") || allowed(k.remote)),
    redownload: input.hasDefaultDownloadFolder ? missing.filter((k) => allowed(k.remote)).map((k) => k.kind) : [],
    // The card must keep at least one source, which cards.ts enforces too.
    clear: sourceCount > 1 ? missing.map((k) => k.kind) : [],
    resource: input.clipSource !== "animethemes"
      && kinds.some((k) => isAnimethemesUrl(k.remote) && (!k.local || k.state === "missing")),
  };
}

export function needsAttention(health: CardHealth): boolean {
  return health.localIssues.length > 0 || health.noPlayableSource;
}
