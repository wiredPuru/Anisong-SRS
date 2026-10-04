import { describe, expect, it, vi } from "vitest";
import { createTimedCache } from "./timedCache.ts";

describe("createTimedCache", () => {
  it("serves a second call from the cache until the ttl passes", async () => {
    let now = 0;
    const load = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    const get = createTimedCache(load, 1000, () => now);
    expect(await get()).toBe("a");
    now = 999;
    expect(await get()).toBe("a");
    now = 1000;
    expect(await get()).toBe("b");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce("ok");
    const get = createTimedCache(load, 1000, () => 0);
    await expect(get()).rejects.toThrow("down");
    expect(await get()).toBe("ok");
  });
});
