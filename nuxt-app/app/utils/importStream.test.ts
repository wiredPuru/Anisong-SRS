import { describe, expect, it, vi } from "vitest";
import { readImportStream } from "./importStream";

function response(text: string, chunkSize = 3) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) controller.enqueue(bytes.slice(i, i + chunkSize));
      controller.close();
    },
  }));
}

describe("import event reader", () => {
  it("decodes chunked UTF-8, reports progress before completion, and accepts a final line without newline", async () => {
    const progress = vi.fn();
    const result = await readImportStream(response([
      { type: "stage", label: "Fetching 日本語" },
      { type: "progress", label: "Resolving", completed: 2, total: 3, skipped: 1 },
      { type: "done", result: { results: [] } },
    ].map((event) => JSON.stringify(event)).join("\n")), progress);
    expect(progress.mock.calls).toEqual([
      [expect.objectContaining({ label: "Fetching 日本語" })],
      [expect.objectContaining({ completed: 2, total: 3, skipped: 1 })],
    ]);
    expect(result).toEqual({ results: [] });
  });

  it.each([
    ['{"type":"stage","label":"Fetching"}\n', "before completion"],
    ['{"type":"done","result":', "could not be read"],
    ['{"type":"error","message":"Provider unavailable"}\n', "Provider unavailable"],
    ['{"type":"done"}\n', "Invalid import response"],
    ['{"type":"progress","label":"Resolving","completed":-1}\n', "Invalid import progress count"],
    ['{"type":"progress","label":"Resolving","completed":4,"total":3}\n', "Invalid import progress total"],
    ['{"type":"done","result":{}}\n{"type":"stage","label":"More"}\n', "Unexpected data"],
  ])("rejects malformed, failed, or truncated streams: %s", async (text, message) => {
    await expect(readImportStream(response(text), () => {})).rejects.toThrow(message);
  });

  it("cancels an outstanding reader when the selection is abandoned", async () => {
    const cancel = vi.fn();
    const controller = new AbortController();
    const pending = readImportStream(new Response(new ReadableStream({ cancel })), () => {}, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("preserves a validation error sent before streaming starts", async () => {
    await expect(readImportStream(Response.json({ statusMessage: "username is required" }, { status: 400 }), () => {}))
      .rejects.toThrow("username is required");
  });
});
