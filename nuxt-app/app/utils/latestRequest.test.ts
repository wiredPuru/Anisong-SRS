import { describe, expect, it } from "vitest";
import { createLatestRequest } from "./latestRequest";

describe("latest request", () => {
  it("rejects stale completions even when the same selection is reopened", () => {
    const requests = createLatestRequest();
    const first = requests.start();
    const second = requests.start();
    expect(first()).toBe(false);
    expect(second()).toBe(true);
    requests.invalidate();
    const reopened = requests.start();
    expect(second()).toBe(false);
    expect(reopened()).toBe(true);
    requests.invalidate();
    expect(reopened()).toBe(false);
  });
});
