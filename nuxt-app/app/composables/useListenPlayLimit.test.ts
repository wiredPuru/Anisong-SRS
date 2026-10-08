import { effectScope, nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useListenPlayLimit } from "./useListenPlayLimit";

function setup(length: number, autoplay = true) {
  const scope = effectScope();
  const enabled = ref(autoplay);
  const key = ref(1);
  const onExpire = vi.fn();
  const limit = scope.run(() => useListenPlayLimit(enabled, key, onExpire))!;
  limit.seconds.value = length;
  return { scope, enabled, key, onExpire, limit };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("play length countdown", () => {
  it("expires after the chosen length of playing time", async () => {
    const { scope, limit, onExpire } = setup(10);
    await nextTick();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(9999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("holds while paused and resumes with the time that was left", async () => {
    const { scope, limit, onExpire } = setup(10);
    await nextTick();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(4000);
    limit.onPlaybackPaused();
    vi.advanceTimersByTime(60000);
    expect(onExpire).not.toHaveBeenCalled();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(5999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("does not restart a running countdown on a repeated playing event", async () => {
    const { scope, limit, onExpire } = setup(10);
    await nextTick();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(6000);
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(4000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("never expires for the full song or with Autoplay off", async () => {
    const full = setup(0);
    await nextTick();
    full.limit.onPlaybackStarted();
    const off = setup(10, false);
    await nextTick();
    off.limit.onPlaybackStarted();
    vi.advanceTimersByTime(600000);
    expect(full.onExpire).not.toHaveBeenCalled();
    expect(off.onExpire).not.toHaveBeenCalled();
    full.scope.stop();
    off.scope.stop();
  });

  it("starts over for a new song", async () => {
    const { scope, limit, key, onExpire } = setup(10);
    await nextTick();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(8000);
    key.value += 1;
    await nextTick();
    vi.advanceTimersByTime(60000);
    expect(onExpire).not.toHaveBeenCalled();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(10000);
    expect(onExpire).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("applies a changed length to the song that is playing", async () => {
    const { scope, limit, onExpire } = setup(10);
    await nextTick();
    limit.onPlaybackStarted();
    vi.advanceTimersByTime(8000);
    limit.seconds.value = 30;
    await nextTick();
    vi.advanceTimersByTime(29999);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onExpire).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it("stops its timer when the scope ends", async () => {
    const { scope, limit } = setup(10);
    await nextTick();
    limit.onPlaybackStarted();
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
  });
});
