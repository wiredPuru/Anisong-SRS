import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { removeUpdateLeftovers, updateLeftovers } from "./updateCleanup.ts";

describe("updateLeftovers", () => {
  it("lists .old and .new for the binary and the three folders", () => {
    expect(updateLeftovers("/app", "gaq-srs")).toEqual([
      "/app/gaq-srs.old",
      "/app/gaq-srs.new",
      "/app/migrations.old",
      "/app/migrations.new",
      "/app/public.old",
      "/app/public.new",
      "/app/kuromoji.old",
      "/app/kuromoji.new",
    ]);
  });

  it("uses the running binary's own name", () => {
    expect(updateLeftovers("/app", "gaq-srs.exe").slice(0, 2)).toEqual([
      "/app/gaq-srs.exe.old",
      "/app/gaq-srs.exe.new",
    ]);
    expect(updateLeftovers("/app", "My GAQ")[0]).toBe("/app/My GAQ.old");
  });
});

describe("removeUpdateLeftovers", () => {
  it("removes only the leftovers and keeps everything else", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gaq-cleanup-"));
    try {
      for (const name of ["gaq-srs", "gaq-srs.old", "notes.old", "public", "public.old"]) {
        await writeFile(join(dir, name), "");
      }
      await mkdir(join(dir, "kuromoji.new", "dict"), { recursive: true });
      await removeUpdateLeftovers(dir, "gaq-srs");
      expect((await readdir(dir)).sort()).toEqual(["gaq-srs", "notes.old", "public"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does nothing when there are no leftovers", async () => {
    await expect(removeUpdateLeftovers(join(tmpdir(), "gaq-missing"), "gaq-srs")).resolves.toBe(
      undefined,
    );
  });
});
