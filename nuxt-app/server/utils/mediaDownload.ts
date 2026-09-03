import { existsSync, unlinkSync } from "node:fs";
import { copyFile, open, stat } from "node:fs/promises";
import { join } from "node:path";
import { cachedFilePathIfPresent } from "./streamCache.ts";

// animethemes.moe blocks Node's default fetch User-Agent with a bare 403; matches server/lib/animethemes.ts.
export const USER_AGENT = "GAQ-SRS/1.0 (personal AMQ study app)";
export const DOWNLOAD_TIMEOUT_MS = 30_000;

export function sanitizeSegment(value: string): string {
  const cleaned = value.replace(/[\\/:*?"<>|]/g, "").trim();
  return cleaned.slice(0, 80) || "untitled";
}

function extensionFromUrl(url: string, fallback: string): string {
  try {
    const match = /\.[a-zA-Z0-9]+$/.exec(new URL(url).pathname);
    return match ? match[0] : fallback;
  } catch {
    return fallback;
  }
}

export interface DownloadFilenameInput {
  animeTitleRomaji: string;
  themeSlot: string;
  artistName: string;
  url: string;
  kind: "video" | "audio";
}

export function buildDownloadBaseName(input: DownloadFilenameInput): { baseName: string; ext: string } {
  const ext = extensionFromUrl(input.url, input.kind === "video" ? ".mp4" : ".mp3");
  const baseName = `${sanitizeSegment(input.animeTitleRomaji)} - ${sanitizeSegment(input.themeSlot)} - ${sanitizeSegment(input.artistName)}`;
  return { baseName, ext };
}

export function resolveUniquePath(destDir: string, baseName: string, ext: string): string {
  let candidate = join(destDir, `${baseName}${ext}`);
  let suffix = 2;
  while (existsSync(candidate)) {
    candidate = join(destDir, `${baseName} (${suffix})${ext}`);
    suffix += 1;
  }
  return candidate;
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}

export type DownloadProgressEvent =
  | { type: "progress"; loaded: number; total: number }
  | { type: "success"; path: string }
  | { type: "error"; message: string };

export async function* downloadMediaFile(
  url: string,
  destDir: string,
  baseName: string,
  ext: string,
): AsyncGenerator<DownloadProgressEvent> {
  const destPath = resolveUniquePath(destDir, baseName, ext);

  // Reuse an already-cached copy of this exact remote clip (feature 41's
  // stream cache, populated by playback/prefetch) instead of re-fetching
  // bytes the app already has on disk. Falls through to the network fetch
  // below if there is no cached copy, or the copy itself fails (e.g. the
  // entry was evicted between the check and the copy).
  const cachedPath = cachedFilePathIfPresent(url);
  if (cachedPath) {
    try {
      await copyFile(cachedPath, destPath);
      const { size } = await stat(destPath);
      yield { type: "progress", loaded: size, total: size };
      yield { type: "success", path: destPath };
      return;
    } catch {
      if (existsSync(destPath)) unlinkSync(destPath);
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    yield { type: "error", message: isTimeout(err) ? "Download timed out." : "Failed to download the file." };
    return;
  }

  if (!response.ok || !response.body) {
    yield { type: "error", message: "Failed to download the file." };
    return;
  }

  const total = Number(response.headers.get("content-length")) || 0;
  let loaded = 0;
  const fileHandle = await open(destPath, "w");
  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await fileHandle.write(value);
      loaded += value.byteLength;
      yield { type: "progress", loaded, total };
    }
  } catch (err) {
    await fileHandle.close();
    if (existsSync(destPath)) unlinkSync(destPath);
    yield { type: "error", message: isTimeout(err) ? "Download timed out." : "Failed to download the file." };
    return;
  }

  await fileHandle.close();
  yield { type: "success", path: destPath };
}
