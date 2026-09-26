import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  checkStagedLayout,
  downloadAndVerify,
  isAllowedAssetUrl,
  parseReadyManifest,
  relaunchCommand,
  probeWritable,
  resolveUpdatesDir,
  safeEntryPath,
  selfUpdateAvailability,
  type SelfUpdateAvailabilityInput,
  unpackAndStage,
  verifyDownload,
} from "./selfUpdate.ts";

const ready: SelfUpdateAvailabilityInput = {
  installDir: "/opt/gaq-srs",
  current: "1.4.0",
  latest: "v1.5.0",
  checkFailed: false,
  asset: { name: "gaq-srs-linux-x64.zip", url: "https://x", digest: "ab".repeat(32), size: 10 },
  writable: true,
};

describe("selfUpdateAvailability", () => {
  it("is available when every condition holds", () => {
    expect(selfUpdateAvailability(ready)).toEqual({ available: true });
  });

  it.each([
    ["not-packaged", { installDir: null }],
    ["check-failed", { checkFailed: true, latest: null }],
    ["up-to-date", { latest: "v1.4.0" }],
    ["up-to-date", { latest: null }],
    ["no-asset", { asset: null }],
    ["no-digest", { asset: { ...ready.asset!, digest: null } }],
    ["not-writable", { writable: false }],
  ] as const)("reports %s", (reason, override) => {
    expect(selfUpdateAvailability({ ...ready, ...override })).toEqual({
      available: false,
      reason,
    });
  });

  it("reports not-packaged before anything else", () => {
    expect(
      selfUpdateAvailability({ ...ready, installDir: null, checkFailed: true, writable: false }),
    ).toEqual({ available: false, reason: "not-packaged" });
  });
});

describe("probeWritable", () => {
  it("is true for a writable folder and leaves nothing behind", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gaq-probe-"));
    try {
      expect(await probeWritable(dir)).toBe(true);
      expect(await readdir(dir)).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("is false for a folder that does not exist", async () => {
    expect(await probeWritable(join(tmpdir(), "gaq-probe-missing", "nope"))).toBe(false);
  });
});

describe("resolveUpdatesDir", () => {
  it("uses the data dir when set", () => {
    expect(resolveUpdatesDir({ GAQ_SRS_DATA_DIR: "/data" }, "/cwd")).toBe("/data/updates");
  });

  it("falls back to .data under the working directory", () => {
    expect(resolveUpdatesDir({}, "/cwd")).toBe("/cwd/.data/updates");
  });
});

describe("isAllowedAssetUrl", () => {
  it("allows an https github.com url", () => {
    expect(isAllowedAssetUrl("https://github.com/o/r/releases/download/v1/a.zip")).toBe(true);
  });

  it.each([
    "http://github.com/a.zip",
    "https://evil.com/a.zip",
    "https://github.com.evil.com/a.zip",
    "https://api.github.com/a.zip",
    "not a url",
  ])("rejects %s", (url) => {
    expect(isAllowedAssetUrl(url)).toBe(false);
  });
});

describe("verifyDownload", () => {
  const expected = { digest: "ab".repeat(32), size: 5 };

  it("passes when digest and size match", () => {
    expect(verifyDownload({ sha256: "ab".repeat(32), bytes: 5 }, expected)).toBeNull();
  });

  it("fails on a size mismatch", () => {
    expect(verifyDownload({ sha256: "ab".repeat(32), bytes: 4 }, expected)).toMatch(/incomplete/);
  });

  it("fails on a digest mismatch", () => {
    expect(verifyDownload({ sha256: "cd".repeat(32), bytes: 5 }, expected)).toMatch(/did not match/);
  });

  it("skips the size check when the size is unknown", () => {
    expect(
      verifyDownload({ sha256: "ab".repeat(32), bytes: 99 }, { ...expected, size: null }),
    ).toBeNull();
  });
});

describe("downloadAndVerify", () => {
  const body = new TextEncoder().encode("release zip bytes");
  const digest = createHash("sha256").update(body).digest("hex");
  const asset = {
    name: "gaq-srs-linux-x64.zip",
    url: "https://github.com/o/r/releases/download/v9/gaq-srs-linux-x64.zip",
    digest,
    size: body.byteLength,
  };
  const okFetch = (async () => new Response(body)) as unknown as typeof fetch;

  async function withDir(run: (dir: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), "gaq-update-"));
    try {
      await run(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it("saves a verified download.zip and reports progress", async () => {
    await withDir(async (dir) => {
      const seen: number[] = [];
      const result = await downloadAndVerify(asset, dir, {
        fetchImpl: okFetch,
        onBytes: (bytes) => seen.push(bytes),
      });
      expect(result).toEqual({ ok: true, zipPath: join(dir, "download.zip") });
      expect(await readFile(join(dir, "download.zip"))).toEqual(Buffer.from(body));
      expect(seen.at(-1)).toBe(body.byteLength);
      expect(await readdir(dir)).toEqual(["download.zip"]);
    });
  });

  it("fails on a wrong digest and removes the partial file", async () => {
    await withDir(async (dir) => {
      const result = await downloadAndVerify({ ...asset, digest: "0".repeat(64) }, dir, {
        fetchImpl: okFetch,
      });
      expect(result.ok).toBe(false);
      expect(await readdir(dir)).toEqual([]);
    });
  });

  it("refuses a non-GitHub url without fetching", async () => {
    let called = false;
    const spy = (async () => {
      called = true;
      return new Response(body);
    }) as unknown as typeof fetch;
    const result = await downloadAndVerify({ ...asset, url: "https://evil.com/a.zip" }, "/unused", {
      fetchImpl: spy,
    });
    expect(result.ok).toBe(false);
    expect(called).toBe(false);
  });

  it("fails on a non-OK response", async () => {
    await withDir(async (dir) => {
      const notFound = (async () => new Response("no", { status: 404 })) as unknown as typeof fetch;
      const result = await downloadAndVerify(asset, dir, { fetchImpl: notFound });
      expect(result.ok).toBe(false);
      expect(await readdir(dir)).toEqual([]);
    });
  });

  it("fails when the body stalls past the idle timeout", async () => {
    await withDir(async (dir) => {
      const stalled = (async (_url: string, init: RequestInit) => {
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(body.slice(0, 3));
            init.signal?.addEventListener("abort", () =>
              controller.error(new DOMException("aborted", "AbortError")),
            );
          },
        });
        return new Response(stream);
      }) as unknown as typeof fetch;
      const result = await downloadAndVerify(asset, dir, { fetchImpl: stalled, idleTimeoutMs: 50 });
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/stalled/) });
      expect(await readdir(dir)).toEqual([]);
    });
  });
});

describe("safeEntryPath", () => {
  const root = "/stage/staged";

  it("resolves a normal nested path inside the root", () => {
    expect(safeEntryPath(root, "public/_nuxt/app.js")).toBe("/stage/staged/public/_nuxt/app.js");
  });

  it.each([
    "../escape.txt",
    "public/../../escape.txt",
    "public\\..\\..\\escape.txt",
    "/etc/passwd",
    "\\windows\\system32",
    "C:\\Windows\\evil.exe",
    "c:/evil",
    "",
    "a\0b",
  ])("rejects %j", (entry) => {
    expect(safeEntryPath(root, entry)).toBeNull();
  });

  it("rejects an entry that resolves to the root itself", () => {
    expect(safeEntryPath(root, ".")).toBeNull();
  });
});

describe("checkStagedLayout", () => {
  const common = ["migrations/meta/_journal.json", "public/favicon.ico", "kuromoji/dict/base.dat.gz"];

  it.each([
    ["darwin", "gaq-srs"],
    ["linux", "gaq-srs"],
    ["win32", "gaq-srs.exe"],
  ])("accepts a full %s layout", (platform, binaryName) => {
    expect(checkStagedLayout([binaryName, ...common], platform)).toEqual({ ok: true, binaryName });
  });

  it("accepts backslash separators", () => {
    expect(
      checkStagedLayout(["gaq-srs.exe", ...common.map((n) => n.replace(/\//g, "\\"))], "win32").ok,
    ).toBe(true);
  });

  it("reports the other platform's binary as missing", () => {
    expect(checkStagedLayout(["gaq-srs", ...common], "win32")).toEqual({
      ok: false,
      missing: ["gaq-srs.exe"],
    });
  });

  it.each([
    ["migrations/meta/_journal.json", 0],
    ["public/", 1],
    ["kuromoji/dict/", 2],
  ] as const)("reports %s missing", (label, index) => {
    const files = ["gaq-srs", ...common.filter((_, i) => i !== index)];
    expect(checkStagedLayout(files, "linux")).toEqual({ ok: false, missing: [label] });
  });

  it("does not accept kuromoji without its dict folder", () => {
    const files = ["gaq-srs", common[0]!, common[1]!, "kuromoji/kuromoji-bundled.cjs"];
    expect(checkStagedLayout(files, "linux")).toEqual({ ok: false, missing: ["kuromoji/dict/"] });
  });
});

describe("parseReadyManifest", () => {
  const manifest = {
    version: "v1.5.0",
    assetName: "gaq-srs-linux-x64.zip",
    sha256: "ab".repeat(32),
    binaryName: "gaq-srs",
    stagedAt: "2026-09-26T00:00:00.000Z",
  };

  it("accepts a complete manifest", () => {
    expect(parseReadyManifest(manifest)).toEqual(manifest);
  });

  it("rejects a missing or empty field", () => {
    expect(parseReadyManifest({ ...manifest, sha256: "" })).toBeNull();
    expect(parseReadyManifest({ ...manifest, version: undefined })).toBeNull();
    expect(parseReadyManifest(null)).toBeNull();
  });
});

describe("unpackAndStage", () => {
  const release = { version: "v1.5.0", assetName: "gaq-srs-linux-x64.zip", sha256: "ab".repeat(32) };
  const text = (value: string) => new TextEncoder().encode(value);

  async function withZip(entries: Record<string, Uint8Array>, run: (dir: string) => Promise<void>) {
    const dir = await mkdtemp(join(tmpdir(), "gaq-stage-"));
    try {
      await writeFile(join(dir, "download.zip"), zipSync(entries));
      await run(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it("stages the files, makes the binary executable, and writes ready.json last", async () => {
    const entries = {
      "gaq-srs": text("binary"),
      "migrations/meta/_journal.json": text("{}"),
      "public/favicon.ico": text("ico"),
      "kuromoji/dict/base.dat.gz": text("dict"),
    };
    await withZip(entries, async (dir) => {
      const result = await unpackAndStage(join(dir, "download.zip"), dir, release, "linux");
      expect(result.ok).toBe(true);
      const staged = join(dir, "staged");
      expect((await readdir(staged)).sort()).toEqual(
        ["gaq-srs", "kuromoji", "migrations", "public", "ready.json"].sort(),
      );
      expect((await stat(join(staged, "gaq-srs"))).mode & 0o111).toBe(0o111);
      const ready = JSON.parse(await readFile(join(staged, "ready.json"), "utf8"));
      expect(parseReadyManifest(ready)).toMatchObject({ ...release, binaryName: "gaq-srs" });
      expect(await readdir(dir)).toEqual(["staged"]);
    });
  });

  it("refuses a zip-slip entry and writes nothing", async () => {
    const entries = {
      "gaq-srs": text("binary"),
      "migrations/meta/_journal.json": text("{}"),
      "public/favicon.ico": text("ico"),
      "kuromoji/dict/base.dat.gz": text("dict"),
      "../escape.txt": text("evil"),
    };
    await withZip(entries, async (dir) => {
      const result = await unpackAndStage(join(dir, "download.zip"), dir, release, "linux");
      expect(result.ok).toBe(false);
      expect(await readdir(dir)).toEqual([]);
    });
  });

  it("refuses a package missing a folder", async () => {
    await withZip({ "gaq-srs": text("binary"), "public/a": text("a") }, async (dir) => {
      const result = await unpackAndStage(join(dir, "download.zip"), dir, release, "linux");
      expect(result).toEqual({ ok: false, error: expect.stringMatching(/laid out/) });
      expect(await readdir(dir)).toEqual([]);
    });
  });
});

describe("relaunchCommand", () => {
  const binary = "/Users/me/My Apps/gaq-srs; rm -rf ~";

  it.each(["darwin", "linux"])("on %s waits with sh and passes values as arguments", (platform) => {
    const result = relaunchCommand(platform, 4242, binary);
    expect(result.command).toBe("/bin/sh");
    expect(result.args.slice(-2)).toEqual(["4242", binary]);
    expect(result.args[1]).not.toContain("4242");
    expect(result.args[1]).not.toContain(binary);
    expect(result.env).toEqual({ GAQ_SRS_SKIP_BROWSER: "1" });
  });

  it("on win32 waits with PowerShell and passes values through the environment", () => {
    const result = relaunchCommand("win32", 4242, "C:\\Apps\\gaq srs'; x\\gaq-srs.exe");
    expect(result.command).toBe("powershell.exe");
    expect(result.args.join(" ")).not.toContain("4242");
    expect(result.args.join(" ")).not.toContain("gaq-srs.exe");
    expect(result.env).toEqual({
      GAQ_SRS_SKIP_BROWSER: "1",
      GAQ_SRS_RELAUNCH_PID: "4242",
      GAQ_SRS_RELAUNCH_BINARY: "C:\\Apps\\gaq srs'; x\\gaq-srs.exe",
    });
  });

  it("the sh script waits for the pid and then runs the binary", async () => {
    const { execFile } = await import("node:child_process");
    const { args } = relaunchCommand("darwin", 999999, "/bin/echo");
    const output = await new Promise<string>((done, fail) =>
      execFile("/bin/sh", args, (err, stdout) => (err ? fail(err) : done(stdout))),
    );
    expect(output).toBe("\n");
  });
});
