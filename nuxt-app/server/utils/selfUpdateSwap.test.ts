import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fsSwapOps, swapInstall, type SwapItem, type SwapOps } from "./selfUpdateSwap.ts";

let root: string;
let installDir: string;
let stagedDir: string;

async function seed(dir: string, binaryName: string, label: string) {
  await mkdir(join(dir, "migrations"), { recursive: true });
  await mkdir(join(dir, "public"), { recursive: true });
  await mkdir(join(dir, "kuromoji"), { recursive: true });
  await writeFile(join(dir, binaryName), label);
  await writeFile(join(dir, "migrations", "m.sql"), label);
  await writeFile(join(dir, "public", "p.txt"), label);
  await writeFile(join(dir, "kuromoji", "k.txt"), label);
}

function itemsFor(runningBinary: string): SwapItem[] {
  return [
    { from: "gaq-srs", to: runningBinary, executable: true },
    { from: "migrations", to: "migrations" },
    { from: "public", to: "public" },
    { from: "kuromoji", to: "kuromoji" },
  ];
}

const read = (...parts: string[]) => readFile(join(...parts), "utf8");

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "gaq-swap-"));
  installDir = join(root, "install");
  stagedDir = join(root, "staged");
  await seed(installDir, "gaq-srs", "old");
  await seed(stagedDir, "gaq-srs", "new");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("swapInstall", () => {
  it("puts the new files in place, keeps the old as .old, and removes staging", async () => {
    expect(await swapInstall({ installDir, stagedDir, items: itemsFor("gaq-srs") })).toEqual({
      ok: true,
    });
    expect(await read(installDir, "gaq-srs")).toBe("new");
    expect(await read(installDir, "public", "p.txt")).toBe("new");
    expect(await read(installDir, "kuromoji.old", "k.txt")).toBe("old");
    expect(await read(installDir, "gaq-srs.old")).toBe("old");
    expect((await stat(join(installDir, "gaq-srs"))).mode & 0o111).toBe(0o111);
    expect((await readdir(installDir)).filter((name) => name.endsWith(".new"))).toEqual([]);
    await expect(stat(stagedDir)).rejects.toThrow();
  });

  it("replaces a renamed running binary under its own name", async () => {
    await rm(join(installDir, "gaq-srs"));
    await writeFile(join(installDir, "My GAQ"), "old");
    const result = await swapInstall({ installDir, stagedDir, items: itemsFor("My GAQ") });
    expect(result.ok).toBe(true);
    expect(await read(installDir, "My GAQ")).toBe("new");
    expect(await read(installDir, "My GAQ.old")).toBe("old");
    expect((await readdir(installDir)).includes("gaq-srs")).toBe(false);
  });

  it("clears leftovers from an earlier attempt first", async () => {
    await writeFile(join(installDir, "gaq-srs.old"), "ancient");
    await mkdir(join(installDir, "public.new"));
    const result = await swapInstall({ installDir, stagedDir, items: itemsFor("gaq-srs") });
    expect(result.ok).toBe(true);
    expect(await read(installDir, "gaq-srs.old")).toBe("old");
  });

  it("leaves the install folder unchanged when a copy fails", async () => {
    const ops: SwapOps = {
      ...fsSwapOps,
      cp: async (source, destination) => {
        if (source.endsWith("public")) throw new Error("disk full");
        await fsSwapOps.cp(source, destination);
      },
    };
    const result = await swapInstall({ installDir, stagedDir, items: itemsFor("gaq-srs"), ops });
    expect(result.ok).toBe(false);
    expect((await readdir(installDir)).sort()).toEqual(
      ["gaq-srs", "kuromoji", "migrations", "public"].sort(),
    );
    expect(await read(installDir, "gaq-srs")).toBe("old");
    expect(await read(stagedDir, "gaq-srs")).toBe("new");
  });

  it("restores every swapped item when a later rename fails", async () => {
    let renames = 0;
    const ops: SwapOps = {
      ...fsSwapOps,
      rename: async (oldPath, newPath) => {
        renames++;
        // The fifth rename moves `public` aside, after two items fully swapped.
        if (renames === 5) throw new Error("in use");
        await fsSwapOps.rename(oldPath, newPath);
      },
    };
    const result = await swapInstall({ installDir, stagedDir, items: itemsFor("gaq-srs"), ops });
    expect(result.ok).toBe(false);
    expect((await readdir(installDir)).sort()).toEqual(
      ["gaq-srs", "kuromoji", "migrations", "public"].sort(),
    );
    for (const path of [["gaq-srs"], ["migrations", "m.sql"], ["public", "p.txt"], ["kuromoji", "k.txt"]]) {
      expect(await read(installDir, ...path)).toBe("old");
    }
  });

  it("restores an item moved aside whose new copy failed to move in", async () => {
    let renames = 0;
    const ops: SwapOps = {
      ...fsSwapOps,
      rename: async (oldPath, newPath) => {
        renames++;
        if (renames === 4) throw new Error("in use");
        await fsSwapOps.rename(oldPath, newPath);
      },
    };
    const result = await swapInstall({ installDir, stagedDir, items: itemsFor("gaq-srs"), ops });
    expect(result.ok).toBe(false);
    expect(await read(installDir, "migrations", "m.sql")).toBe("old");
    expect(await read(installDir, "gaq-srs")).toBe("old");
    expect((await readdir(installDir)).sort()).toEqual(
      ["gaq-srs", "kuromoji", "migrations", "public"].sort(),
    );
  });
});
