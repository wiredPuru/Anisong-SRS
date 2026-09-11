import { effectScope, nextTick, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useActivityTimer } from "./useActivityTimer";

afterEach(() => vi.useRealTimers());

describe("activity waiting time", () => {
  it("resets idle time on real progress without resetting the operation duration", async () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const revision = ref(0);
    const state = scope.run(() => useActivityTimer(() => "import", () => true, revision))!;
    vi.advanceTimersByTime(16000);
    expect(state.isSlow.value).toBe(true);
    revision.value += 1;
    await nextTick();
    expect(state.isSlow.value).toBe(false);
    expect(state.elapsedSeconds.value).toBe(16);
    vi.advanceTimersByTime(15000);
    expect(state.isSlow.value).toBe(true);
    expect(state.elapsedSeconds.value).toBe(31);
    scope.stop();
  });

  it("does not schedule server-side work and clears timers when inactive", async () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const active = ref(false);
    const state = scope.run(() => useActivityTimer(() => "request", active))!;
    expect(vi.getTimerCount()).toBe(0);
    active.value = true;
    await nextTick();
    vi.advanceTimersByTime(2000);
    expect(state.elapsedSeconds.value).toBe(2);
    active.value = false;
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
    expect(state.elapsedSeconds.value).toBe(0);
    scope.stop();
  });

  it("marks a response slow only after fifteen seconds and resets for a new request", async () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const request = ref("first search");
    const state = scope.run(() => useActivityTimer(request))!;
    vi.advanceTimersByTime(14999);
    expect(state.elapsedSeconds.value).toBe(14);
    expect(state.isSlow.value).toBe(false);
    vi.advanceTimersByTime(1);
    expect(state.isSlow.value).toBe(true);
    request.value = "second search";
    await nextTick();
    expect(state.elapsedSeconds.value).toBe(0);
    expect(state.isSlow.value).toBe(false);
    expect(vi.getTimerCount()).toBe(1);
    scope.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20000);
    expect(state.elapsedSeconds.value).toBe(0);
  });

  it("uses elapsed wall time when timer delivery is delayed", () => {
    vi.useFakeTimers();
    const scope = effectScope();
    const state = scope.run(() => useActivityTimer(() => "request"))!;
    vi.setSystemTime(Date.now() + 30000);
    vi.advanceTimersByTime(1000);
    expect(state.elapsedSeconds.value).toBe(31);
    expect(state.isSlow.value).toBe(true);
    scope.stop();
  });
});
