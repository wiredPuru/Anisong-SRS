import { chmod, cp, rename, rm } from "node:fs/promises";
import { join } from "node:path";

export interface SwapItem {
  from: string;
  to: string;
  executable?: boolean;
}

export interface SwapOps {
  cp: (source: string, destination: string) => Promise<void>;
  rename: (oldPath: string, newPath: string) => Promise<void>;
  rm: (path: string) => Promise<void>;
  chmod: (path: string, mode: number) => Promise<void>;
}

export const fsSwapOps: SwapOps = {
  cp: (source, destination) => cp(source, destination, { recursive: true }),
  rename: (oldPath, newPath) => rename(oldPath, newPath),
  rm: (path) => rm(path, { recursive: true, force: true }),
  chmod: (path, mode) => chmod(path, mode),
};

export interface SwapInput {
  installDir: string;
  stagedDir: string;
  items: SwapItem[];
  ops?: SwapOps;
}

export type SwapResult = { ok: true } | { ok: false; error: string };

// Every item is copied next to its target as `.new` before anything is
// renamed: the data dir and the install dir can sit on different volumes, where
// a direct rename fails with EXDEV. The renames that follow stay inside one
// folder. The running binary is renamed to `.old`, never overwritten, which is
// the one thing Windows allows for an executable in use.
export async function swapInstall(input: SwapInput): Promise<SwapResult> {
  const { installDir, stagedDir, items, ops = fsSwapOps } = input;
  const target = (item: SwapItem, suffix = "") => join(installDir, item.to + suffix);

  const removeNew = async () => {
    for (const item of items) await ops.rm(target(item, ".new")).catch(() => {});
  };

  try {
    for (const item of items) {
      await ops.rm(target(item, ".new"));
      await ops.rm(target(item, ".old"));
    }
    for (const item of items) {
      await ops.cp(join(stagedDir, item.from), target(item, ".new"));
      if (item.executable) await ops.chmod(target(item, ".new"), 0o755);
    }
  } catch {
    await removeNew();
    return { ok: false, error: "The update could not be copied into the app's folder." };
  }

  const swapped: SwapItem[] = [];
  const movedAside: SwapItem[] = [];
  try {
    for (const item of items) {
      await ops.rename(target(item), target(item, ".old"));
      movedAside.push(item);
      await ops.rename(target(item, ".new"), target(item));
      swapped.push(item);
    }
  } catch {
    for (const item of [...movedAside].reverse()) {
      if (swapped.includes(item)) await ops.rm(target(item)).catch(() => {});
      await ops.rename(target(item, ".old"), target(item)).catch(() => {});
    }
    await removeNew();
    return { ok: false, error: "The update could not replace the app's files. Nothing was changed." };
  }

  await ops.rm(stagedDir).catch(() => {});
  return { ok: true };
}
