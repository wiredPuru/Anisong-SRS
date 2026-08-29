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

export function formatDownloadProgress(progress: DownloadProgress | undefined): string {
  if (!progress) return "Downloading...";
  if (progress.total > 0) {
    return `${Math.round((progress.loaded / progress.total) * 100)}%`;
  }
  return `${(progress.loaded / (1024 * 1024)).toFixed(1)} MB`;
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
    downloadProgress[progressKey] = { loaded: 0, total: 0 };

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
    }
  }

  return { downloading, downloadProgress, downloadError, downloadKey, canDownload, hasAnyDownloadableSource, downloadMedia };
}
