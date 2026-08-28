import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// animethemes.moe blocks Node's default fetch User-Agent with a bare 403; matches server/lib/animethemes.ts.
const USER_AGENT = "GAQ-SRS/1.0 (personal AMQ study app)";
const DOWNLOAD_TIMEOUT_MS = 30_000;

function sanitizeSegment(value: string): string {
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

function resolveUniquePath(destDir: string, baseName: string, ext: string): string {
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

export type DownloadResult = { path: string } | { error: string };

export async function downloadMediaFile(url: string, destDir: string, baseName: string, ext: string): Promise<DownloadResult> {
  const destPath = resolveUniquePath(destDir, baseName, ext);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    return { error: isTimeout(err) ? "Download timed out." : "Failed to download the file." };
  }

  if (!response.ok) {
    return { error: "Failed to download the file." };
  }

  try {
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destPath, buffer);
  } catch (err) {
    if (existsSync(destPath)) unlinkSync(destPath);
    return { error: isTimeout(err) ? "Download timed out." : "Failed to download the file." };
  }

  return { path: destPath };
}
