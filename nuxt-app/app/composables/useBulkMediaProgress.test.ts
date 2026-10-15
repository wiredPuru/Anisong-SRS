import { describe, expect, it } from "vitest";
import { useBulkMediaProgress } from "./useBulkMediaProgress";

describe("useBulkMediaProgress", () => {
  it("advances completed count and current label while running, without counting a failure as success", async () => {
    const bulk = useBulkMediaProgress();
    const seenDuringStep2 = { completed: -1, current: "" };

    const pending = bulk.runSteps([
      { label: "Track A", run: async () => true },
      {
        label: "Track B",
        run: async () => {
          seenDuringStep2.completed = bulk.progress.completed;
          seenDuringStep2.current = bulk.progress.current ?? "";
          return false;
        },
      },
      { label: "Track C", run: async () => true },
    ]);

    expect(bulk.running.value).toBe(true);
    expect(bulk.progress.total).toBe(3);
    await pending;

    expect(seenDuringStep2).toEqual({ completed: 1, current: "Track B" });
    expect(bulk.running.value).toBe(false);
    expect(bulk.progress.completed).toBe(3);
    expect(bulk.progress.failed).toBe(1);
    expect(bulk.progress.current).toBeNull();
    expect(bulk.summary.value).toEqual({ total: 3, failed: 1 });
  });

  it("resets stale state and finishes cleanly for an empty run", async () => {
    const bulk = useBulkMediaProgress();
    await bulk.runSteps([{ label: "First", run: async () => false }]);
    expect(bulk.summary.value).toEqual({ total: 1, failed: 1 });

    await bulk.runSteps([]);
    expect(bulk.progress).toEqual({ completed: 0, total: 0, failed: 0, current: null });
    expect(bulk.summary.value).toEqual({ total: 0, failed: 0 });
    expect(bulk.running.value).toBe(false);
  });

  it("clears progress and summary on reset", async () => {
    const bulk = useBulkMediaProgress();
    await bulk.runSteps([{ label: "First", run: async () => false }]);
    bulk.reset();
    expect(bulk.progress).toEqual({ completed: 0, total: 0, failed: 0, current: null });
    expect(bulk.summary.value).toBeNull();
    expect(bulk.running.value).toBe(false);
  });

  it("still reports a final summary when a step throws instead of resolving false", async () => {
    const bulk = useBulkMediaProgress();
    await expect(
      bulk.runSteps([
        { label: "Ok", run: async () => true },
        {
          label: "Throws",
          run: async () => {
            throw new Error("unexpected");
          },
        },
      ]),
    ).rejects.toThrow("unexpected");

    expect(bulk.running.value).toBe(false);
    expect(bulk.progress.current).toBeNull();
    expect(bulk.summary.value).toEqual({ total: 2, failed: 0 });
  });

  it("stops after the step in flight when asked, and says so in the summary", async () => {
    const bulk = useBulkMediaProgress();
    const ran: string[] = [];
    await bulk.runSteps([
      { label: "A", run: async () => { ran.push("A"); return true; } },
      { label: "B", run: async () => { ran.push("B"); bulk.stop(); return true; } },
      { label: "C", run: async () => { ran.push("C"); return true; } },
    ]);
    expect(ran).toEqual(["A", "B"]);
    expect(bulk.progress.completed).toBe(2);
    expect(bulk.summary.value).toEqual({ total: 3, failed: 0, stopped: true });

    await bulk.runSteps([{ label: "D", run: async () => true }]);
    expect(bulk.summary.value).toEqual({ total: 1, failed: 0 });
  });

  it("ignores stop when nothing is running", async () => {
    const bulk = useBulkMediaProgress();
    bulk.stop();
    await bulk.runSteps([{ label: "A", run: async () => true }]);
    expect(bulk.summary.value).toEqual({ total: 1, failed: 0 });
  });
});
