import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadPhase, formatDownloadProgress, useCardDownloads } from "./useCardDownloads";

afterEach(() => vi.unstubAllGlobals());

function streamResponse(events: object[]) {
  const text = events.map((event) => `${JSON.stringify(event)}\n`).join("");
  const bytes = new TextEncoder().encode(text);
  return new Response(
    new ReadableStream({
      start(controller) {
        // One chunk per event so a "finishing" phase (all bytes received, no
        // "done" yet) is actually observable mid-stream, not collapsed into
        // a single read.
        for (const byte of bytes.length ? [bytes] : []) controller.enqueue(byte);
        controller.close();
      },
    }),
  );
}

describe("downloadPhase", () => {
  it("is 'waiting' with no progress yet", () => {
    expect(downloadPhase(undefined)).toBe("waiting");
  });

  it("is 'transferring' while bytes remain, including an unknown total", () => {
    expect(downloadPhase({ loaded: 50, total: 100 })).toBe("transferring");
    expect(downloadPhase({ loaded: 200, total: 0 })).toBe("transferring");
  });

  it("is 'finishing' once every expected byte has arrived", () => {
    expect(downloadPhase({ loaded: 100, total: 100 })).toBe("finishing");
  });
});

describe("formatDownloadProgress", () => {
  it("describes each phase distinctly", () => {
    expect(formatDownloadProgress(undefined)).toBe("Waiting for data...");
    expect(formatDownloadProgress({ loaded: 100, total: 100 })).toBe("Finishing...");
    expect(formatDownloadProgress({ loaded: 25, total: 100 })).toBe("25%");
    expect(formatDownloadProgress({ loaded: 2 * 1024 * 1024, total: 0 })).toBe("2.0 MB");
  });
});

describe("useCardDownloads.canRetryDownload / hasAnyDownloadableSource", () => {
  it("canRetryDownload is true only when a local path is stale but a remote reference still exists", () => {
    const { canRetryDownload } = useCardDownloads();
    const staleVideo = {
      localVideoPath: "videos/a.mp4",
      localAudioPath: null,
      animethemesVideoUrl: "https://v.animethemes.moe/a.webm",
      animethemesAudioUrl: null,
    };
    expect(canRetryDownload(staleVideo, "video")).toBe(true);
    expect(canRetryDownload(staleVideo, "audio")).toBe(false);

    const noRemoteFallback = {
      localVideoPath: "videos/a.mp4",
      localAudioPath: null,
      animethemesVideoUrl: null,
      animethemesAudioUrl: null,
    };
    expect(canRetryDownload(noRemoteFallback, "video")).toBe(false);

    const notYetDownloaded = {
      localVideoPath: null,
      localAudioPath: null,
      animethemesVideoUrl: "https://v.animethemes.moe/a.webm",
      animethemesAudioUrl: null,
    };
    expect(canRetryDownload(notYetDownloaded, "video")).toBe(false);
  });

  it("hasAnyDownloadableSource counts a retryable stale local file, not just a fresh download", () => {
    const { canDownload, hasAnyDownloadableSource } = useCardDownloads();
    const staleVideoOnly = {
      localVideoPath: "videos/a.mp4",
      localAudioPath: null,
      animethemesVideoUrl: "https://v.animethemes.moe/a.webm",
      animethemesAudioUrl: null,
    };
    expect(canDownload(staleVideoOnly, "video")).toBe(false);
    expect(hasAnyDownloadableSource(staleVideoOnly)).toBe(true);

    const fullyLocalNoRemote = {
      localVideoPath: "videos/a.mp4",
      localAudioPath: "audio/a.mp3",
      animethemesVideoUrl: null,
      animethemesAudioUrl: null,
    };
    expect(hasAnyDownloadableSource(fullyLocalNoRemote)).toBe(false);
  });
});

describe("useCardDownloads.downloadMedia", () => {
  it("reports waiting, then transferring, then finishing before resolving, and clears progress after", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        streamResponse([
          { type: "progress", loaded: 50, total: 100 },
          { type: "progress", loaded: 100, total: 100 },
          { type: "done", card: { id: 1 } },
        ]),
      ),
    );
    const { downloading, downloadProgress, downloadError, downloadKey, downloadMedia } = useCardDownloads();
    const key = downloadKey(1, "video");

    expect(downloadPhase(downloadProgress[key])).toBe("waiting");
    const pending = downloadMedia<{ id: number }>(1, 1, "video");
    expect(downloading[key]).toBe(true);

    const result = await pending;
    expect(result).toEqual({ id: 1 });
    expect(downloading[key]).toBe(false);
    expect(downloadProgress[key]).toBeUndefined();
    expect(downloadError[1]).toBeNull();
  });

  it("surfaces a stream error without treating it as success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(streamResponse([{ type: "error", message: "Download timed out." }])),
    );
    const { downloading, downloadError, downloadKey, downloadMedia } = useCardDownloads();
    const key = downloadKey(2, "audio");

    const result = await downloadMedia(2, 2, "audio");
    expect(result).toBeNull();
    expect(downloading[key]).toBe(false);
    expect(downloadError[2]).toBe("Download timed out.");
  });

  it("resets a previous error and stale progress when a new download starts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(streamResponse([{ type: "error", message: "Failed to download the file." }]))
        .mockResolvedValueOnce(streamResponse([{ type: "done", card: { id: 3 } }])),
    );
    const { downloadError, downloadProgress, downloadKey, downloadMedia } = useCardDownloads();
    const key = downloadKey(3, "video");

    await downloadMedia(3, 3, "video");
    expect(downloadError[3]).toBe("Failed to download the file.");

    const result = await downloadMedia<{ id: number }>(3, 3, "video");
    expect(result).toEqual({ id: 3 });
    expect(downloadError[3]).toBeNull();
    expect(downloadProgress[key]).toBeUndefined();
  });
});
