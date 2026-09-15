import { describe, expect, it, vi } from "vitest";
import { createReviewSubmission } from "./reviewSubmission";

describe("review submission", () => {
  it("locks through saving and advancing", async () => {
    let finish!: () => void;
    const advance = vi.fn(() => new Promise<boolean>((resolve) => { finish = () => resolve(true); }));
    const save = vi.fn(async () => true);
    const submission = createReviewSubmission();
    const first = submission.run(save, advance);
    await Promise.resolve();
    await submission.run(save, advance);
    expect(save).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledTimes(1);
    finish(); await first;
  });

  it("retains a saved review when next-card loading fails", async () => {
    const submission = createReviewSubmission();
    const save = vi.fn(async () => true);
    const advance = vi.fn<() => Promise<boolean>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    await expect(submission.run(save, advance)).rejects.toThrow("offline");
    await submission.run(save, advance);
    expect(save).toHaveBeenCalledTimes(1);
    expect(advance).toHaveBeenCalledTimes(2);
  });

  it("retries failed saves without advancing prematurely", async () => {
    const submission = createReviewSubmission();
    const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const advance = vi.fn(async () => true);
    await submission.run(save, advance);
    expect(advance).not.toHaveBeenCalled();
    await submission.run(save, advance);
    expect(save).toHaveBeenCalledTimes(2);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("separates a saved review from deliberate advancement", async () => {
    const submission = createReviewSubmission();
    const save = vi.fn(async () => true);
    const advance = vi.fn(async () => true);

    expect(await submission.saveOnce(save)).toBe("saved");
    expect(advance).not.toHaveBeenCalled();
    expect(await submission.saveOnce(save)).toBe("ignored");
    expect(save).toHaveBeenCalledTimes(1);
    expect(await submission.advanceOnce(advance)).toBe(true);
    expect(await submission.advanceOnce(advance)).toBe(false);
    expect(advance).toHaveBeenCalledTimes(1);
  });

  it("allows next-card retry when the fetch reports failure", async () => {
    const submission = createReviewSubmission();
    await submission.saveOnce(async () => true);
    const advance = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    expect(await submission.advanceOnce(advance)).toBe(false);
    expect(await submission.advanceOnce(advance)).toBe(true);
    expect(advance).toHaveBeenCalledTimes(2);
  });
});
