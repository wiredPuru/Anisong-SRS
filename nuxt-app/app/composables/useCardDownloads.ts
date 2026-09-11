import { reactive } from "vue";

export interface DownloadableCard {
  localVideoPath: string | null;
  localAudioPath: string | null;
  animethemesVideoUrl: string | null;
  animethemesAudioUrl: string | null;
}

export interface DownloadProgress {
  loaded: number;
  total: number;
}

// "waiting": no bytes received yet (nothing to show but that a request is in flight).
// "transferring": bytes are arriving; total may be unknown (an unknown-size response).
// "finishing": every expected byte has arrived but the server hasn't confirmed
// completion yet (still writing the file / updating the card).
export type DownloadPhase = "waiting" | "transferring" | "finishing";

export function downloadPhase(progress: DownloadProgress | undefined): DownloadPhase {
  if (!progress) return "waiting";
  if (progress.total > 0 && progress.loaded >= progress.total) return "finishing";
  return "transferring";
}

export function formatDownloadProgress(progress: DownloadProgress | undefined): string {
  const phase = downloadPhase(progress);
  if (phase === "waiting") return "Waiting for data...";
  if (phase === "finishing") return "Finishing...";
  if (progress!.total > 0) {
    return `${Math.round((progress!.loaded / progress!.total) * 100)}%`;
  }
  return `${(progress!.loaded / (1024 * 1024)).toFixed(1)} MB`;
}

export function useCardDownloads() {
  const downloading = reactive<Record<string, boolean>>({});
  const downloadProgress = reactive<Record<string, DownloadProgress>>({});
  const downloadError = reactive<Record<string | number, string | null>>({});

  function downloadKey(key: string | number, kind: "video" | "audio"): string {
    return `${key}:${kind}`;
  }

  function canDownload(card: DownloadableCard, kind: "video" | "audio"): boolean {
    return kind === "video"
      ? Boolean(card.animethemesVideoUrl) && !card.localVideoPath
      : Boolean(card.animethemesAudioUrl) && !card.localAudioPath;
  }

  function hasAnyDownloadableSource(card: DownloadableCard): boolean {
    return canDownload(card, "video") || canDownload(card, "audio");
  }

  async function downloadMedia<T>(key: string | number, cardId: number, kind: "video" | "audio"): Promise<T | null> {
    const progressKey = downloadKey(key, kind);
    downloadError[key] = null;
    downloading[progressKey] = true;
    delete downloadProgress[progressKey];

    try {
      const response = await fetch("/api/cards/download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cardId, kind }),
      });

      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.statusMessage ?? "Failed to download the file.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result: T | null = null;
      let errorMessage: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          if (event.type === "progress") {
            downloadProgress[progressKey] = { loaded: event.loaded, total: event.total };
          } else if (event.type === "done") {
            result = event.card as T;
          } else if (event.type === "error") {
            errorMessage = event.message;
          }
        }
      }

      if (errorMessage) throw new Error(errorMessage);
      if (!result) throw new Error("Download ended unexpectedly.");
      return result;
    } catch (err) {
      downloadError[key] = err instanceof Error ? err.message : "Failed to download the file.";
      return null;
    } finally {
      downloading[progressKey] = false;
      delete downloadProgress[progressKey];
    }
  }

  return { downloading, downloadProgress, downloadError, downloadKey, canDownload, hasAnyDownloadableSource, downloadMedia };
}
