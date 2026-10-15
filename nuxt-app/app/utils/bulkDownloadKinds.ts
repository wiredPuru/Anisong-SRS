export type DownloadKind = "video" | "audio";

export interface BulkDownloadKinds {
  video: boolean;
  audio: boolean;
}

export const BULK_DOWNLOAD_KINDS_STORAGE_KEY = "gaqSrs:bulkDownloadKinds";
export const DEFAULT_BULK_DOWNLOAD_KINDS: BulkDownloadKinds = { video: true, audio: true };

/** The kinds a "Download all" should fetch, video first to match the old order. */
export function selectedDownloadKinds(kinds: BulkDownloadKinds): DownloadKind[] {
  const selected: DownloadKind[] = [];
  if (kinds.video) selected.push("video");
  if (kinds.audio) selected.push("audio");
  return selected;
}

/** A stored choice, or both kinds when nothing usable is stored. */
export function parseBulkDownloadKinds(raw: string | null): BulkDownloadKinds {
  if (!raw) return { ...DEFAULT_BULK_DOWNLOAD_KINDS };
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && "video" in value && "audio" in value &&
      typeof value.video === "boolean" && typeof value.audio === "boolean") {
      return { video: value.video, audio: value.audio };
    }
  } catch {
    // Falls through to the default below.
  }
  return { ...DEFAULT_BULK_DOWNLOAD_KINDS };
}
