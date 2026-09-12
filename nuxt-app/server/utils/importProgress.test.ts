import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRequestHeader, setResponseHeader, type H3Event } from "h3";
import { createImportStream, respondWithImportProgress } from "./importProgress";

vi.mock("h3", () => ({
  getRequestHeader: vi.fn(), setResponseHeader: vi.fn(), sendStream: vi.fn((_event, stream) => stream),
}));
beforeEach(() => vi.clearAllMocks());

describe("import response transport", () => {
  it("writes progress before the task finishes, then one final result", async () => {
    let finish!: () => void;
    const gate = new Promise<void>((resolve) => { finish = resolve; });
    const chunks: string[] = [];
    const stream = createImportStream(async (report) => {
      report({ label: "Fetching" });
      await gate;
      report({ label: "Resolving", completed: 1, total: 1 });
      return { results: [] };
    });
    stream.on("data", (chunk) => chunks.push(String(chunk)));
    await vi.waitFor(() => expect(chunks.join("")).toContain('"type":"stage"'));
    expect(chunks.join("")).not.toContain('"type":"done"');
    const ended = new Promise<void>((resolve) => stream.on("end", resolve));
    finish();
    await ended;
    expect(chunks.join("").trim().split("\n").map((line) => JSON.parse(line).type)).toEqual(["stage", "progress", "done"]);
  });

  it("reports a terminal error without leaking internal exceptions or false completion", async () => {
    const stream = createImportStream(async () => { throw new Error("SQLITE internal detail"); });
    let text = "";
    for await (const chunk of stream) text += chunk;
    expect(JSON.parse(text)).toEqual({ type: "error", message: "Import failed. Please try again.", unavailable: false });
  });

  it("preserves actionable public errors", async () => {
    const stream = createImportStream(async () => { throw Object.assign(new Error("hidden"), { statusMessage: "User not found" }); });
    let text = "";
    for await (const chunk of stream) text += chunk;
    expect(JSON.parse(text).message).toBe("User not found");
  });

  it("retains JSON mode unless streaming was requested", async () => {
    const event = {} as H3Event;
    vi.mocked(getRequestHeader).mockReturnValue("application/json");
    const task = vi.fn(async (report) => { report({ label: "Fetching" }); return { results: [1] }; });
    expect(await respondWithImportProgress(event, task)).toEqual({ results: [1] });
    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
