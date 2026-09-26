import { rm } from "node:fs/promises";
import { join } from "node:path";

const SIBLING_FOLDERS = ["migrations", "public", "kuromoji"];

// What a finished or interrupted self-update (feature 82) can leave beside the
// binary: the previous build as `.old`, or a half-copied `.new`.
export function updateLeftovers(installDir: string, binaryName: string): string[] {
  return [binaryName, ...SIBLING_FOLDERS].flatMap((name) => [
    join(installDir, `${name}.old`),
    join(installDir, `${name}.new`),
  ]);
}

export async function removeUpdateLeftovers(installDir: string, binaryName: string): Promise<void> {
  for (const path of updateLeftovers(installDir, binaryName)) {
    await rm(path, { recursive: true, force: true }).catch(() => {});
  }
}
