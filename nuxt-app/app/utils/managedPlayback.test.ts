import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createManagedPlayback, type ManagedMediaElement, type ManagedPlaybackOptions } from "./managedPlayback";

class FakeMedia extends EventTarget implements ManagedMediaElement {
  readyState = 0;
  duration = 90;
  seeking = false;
  paused = true;
  error: { code: number } | null = null;
  preload = "metadata";
  muted = false;
  src: string | null = "/clip.webm";
  private position = 0;
  get currentTime() { return this.position; }
  set currentTime(value: number) { this.position = value; this.seeking = true; }
  getAttribute(name: string) { return name === "src" ? this.src : null; }
  removeAttribute(name: string) { if (name === "src") this.src = null; }
  load = vi.fn();
  play = vi.fn(() => { this.paused = false; return Promise.resolve(); });
  pause = vi.fn(() => {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  receive(event: string) {
    if (event === "loadedmetadata") this.readyState = 1;
    if (event === "canplay") this.readyState = 3;
    if (event === "seeked") this.seeking = false;
    if (event === "playing") this.paused = false;
    this.dispatchEvent(new Event(event));
  }
}

const controllers: ReturnType<typeof createManagedPlayback>[] = [];
function setup(options: Partial<ManagedPlaybackOptions> = {}, ready = false) {
  const media = new FakeMedia();
  if (ready) media.readyState = 3;
  const controller = createManagedPlayback(media, { presentationId: 7, role: "standby", ...options });
  controllers.push(controller);
  return { media, controller };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const controller of controllers.splice(0)) controller.stop();
  vi.useRealTimers();
});

describe("managed preparation", () => {
  it("prepares silently and waits for decoded data and the chosen seek", async () => {
    const { media, controller } = setup({ startAt: () => 20 });
    const settled = vi.fn();
    const result = controller.prepare().then(settled);
    expect(media.preload).toBe("auto");
    expect(media.load).toHaveBeenCalledTimes(1);
    media.receive("loadedmetadata");
    expect(media.currentTime).toBe(20);
    media.receive("canplay");
    await flush();
    expect(settled).not.toHaveBeenCalled();
    media.receive("seeked");
    await result;
    expect(settled).toHaveBeenCalledWith({ status: "ready", snapshot: expect.objectContaining({
      presentationId: 7, role: "standby", duration: 90, startOffset: 20, ready: true,
    }) });
    expect(media.play).not.toHaveBeenCalled();
    expect(media.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("chooses the offset and starts loading once for concurrent preparation", async () => {
    const startAt = vi.fn(() => 0);
    const { media, controller } = setup({ startAt });
    const first = controller.prepare();
    const second = controller.prepare();
    media.receive("loadedmetadata");
    media.receive("loadedmetadata");
    media.receive("canplay");
    expect((await first).status).toBe("ready");
    expect((await second).status).toBe("ready");
    expect(startAt).toHaveBeenCalledTimes(1);
    expect(media.load).toHaveBeenCalledTimes(1);
  });

  it("reports unresolved duration without inventing a finite endpoint", async () => {
    const { media, controller } = setup({}, true);
    media.duration = Infinity;
    expect(await controller.prepare()).toMatchObject({ status: "ready", snapshot: { duration: null } });
  });

  it.each([-1, NaN, Infinity, 90, 91])("rejects the invalid start offset %s", async (offset) => {
    const { controller } = setup({ startAt: () => offset }, true);
    expect(await controller.prepare()).toEqual({ status: "failed", reason: "start-offset" });
  });

  it("reports missing sources and provider/media errors", async () => {
    const missing = setup();
    missing.media.src = null;
    expect(await missing.controller.prepare()).toEqual({ status: "failed", reason: "source" });
    const broken = setup();
    const result = broken.controller.prepare();
    broken.media.error = { code: 4 };
    broken.media.receive("error");
    expect(await result).toEqual({ status: "failed", reason: "media" });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("managed playback", () => {
  it("requires actual playing even after the native play promise resolves", async () => {
    const { media, controller } = setup({}, true);
    const settled = vi.fn();
    const result = controller.play().then(settled);
    await flush();
    expect(media.play).toHaveBeenCalledTimes(1);
    expect(settled).not.toHaveBeenCalled();
    media.receive("playing");
    await result;
    expect(settled).toHaveBeenCalledWith({ status: "playing", snapshot: expect.objectContaining({ state: "playing" }) });
  });

  it("coalesces concurrent play requests", async () => {
    const { media, controller } = setup({}, true);
    const first = controller.play();
    expect(controller.play()).toBe(first);
    await flush();
    media.receive("playing");
    expect((await first).status).toBe("playing");
    expect(media.play).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["NotAllowedError", { status: "blocked" }],
    ["AbortError", { status: "cancelled" }],
    ["NotSupportedError", { status: "failed", reason: "playback" }],
  ] as const)("distinguishes a %s rejection", async (name, expected) => {
    const { media, controller } = setup({}, true);
    media.play.mockRejectedValue(new DOMException("Cannot play", name));
    expect(await controller.play()).toEqual(expected);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("can retry blocked playback after a user gesture without choosing a new offset", async () => {
    const startAt = vi.fn(() => 0);
    const { media, controller } = setup({ startAt }, true);
    media.play.mockRejectedValueOnce(new DOMException("Needs click", "NotAllowedError"));
    expect(await controller.play()).toEqual({ status: "blocked" });
    const retry = controller.play();
    await flush();
    media.receive("playing");
    expect((await retry).status).toBe("playing");
    expect(startAt).toHaveBeenCalledTimes(1);
  });

  it("cancels an unconfirmed play when the native element pauses", async () => {
    const { media, controller } = setup({}, true);
    const result = controller.play();
    await flush();
    media.pause();
    expect(await result).toEqual({ status: "cancelled" });
    media.receive("playing");
    expect(media.paused).toBe(true);
  });

  it("holds the position and chosen offset through pause, resume, and role promotion", async () => {
    const startAt = vi.fn(() => 0);
    const { media, controller } = setup({ startAt }, true);
    const first = controller.play();
    await flush();
    media.receive("playing");
    await first;
    media.currentTime = 12;
    media.receive("seeked");
    controller.pause();
    controller.setRole("foreground");
    const resumed = controller.play();
    await flush();
    media.receive("playing");
    expect(await resumed).toMatchObject({ status: "playing", snapshot: { currentTime: 12, startOffset: 0, role: "foreground" } });
    expect(startAt).toHaveBeenCalledTimes(1);
    media.receive("waiting");
    expect(controller.getSnapshot().state).toBe("buffering");
  });

  it("bounds stalled preparation and playback waits", async () => {
    const preparing = setup();
    const prepared = preparing.controller.prepare();
    vi.advanceTimersByTime(30000);
    expect(await prepared).toEqual({ status: "failed", reason: "timeout" });
    const playing = setup({}, true);
    const started = playing.controller.play();
    await flush();
    vi.advanceTimersByTime(30000);
    expect(await started).toEqual({ status: "failed", reason: "timeout" });
    expect(playing.media.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports a synchronous native play failure", async () => {
    const { media, controller } = setup({}, true);
    media.play.mockImplementation(() => { throw new Error("Cannot start"); });
    expect(await controller.play()).toEqual({ status: "failed", reason: "playback" });
    expect(media.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("settles an ended clip without waiting for an unconfirmed play to time out", async () => {
    const { media, controller } = setup({}, true);
    const result = controller.play();
    await flush();
    media.receive("ended");
    expect(await result).toEqual({ status: "cancelled" });
    expect(controller.getSnapshot().state).toBe("ended");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("managed cancellation", () => {
  it("cancels preparation on pause without choosing a new offset on resume", async () => {
    const startAt = vi.fn(() => 0);
    const { media, controller } = setup({ startAt });
    const first = controller.prepare();
    media.receive("loadedmetadata");
    controller.pause();
    expect(await first).toEqual({ status: "cancelled" });
    const second = controller.prepare();
    media.receive("canplay");
    expect((await second).status).toBe("ready");
    expect(startAt).toHaveBeenCalledTimes(1);
  });

  it("cancels preparation and releases the source permanently on stop", async () => {
    const onChange = vi.fn();
    const { media, controller } = setup({ onChange });
    const result = controller.prepare();
    controller.stop();
    expect(await result).toEqual({ status: "cancelled" });
    expect(media.src).toBeNull();
    expect(media.muted).toBe(true);
    expect(media.paused).toBe(true);
    const calls = onChange.mock.calls.length;
    media.receive("canplay");
    media.receive("playing");
    expect(onChange).toHaveBeenCalledTimes(calls);
    expect(await controller.play()).toEqual({ status: "cancelled" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pauses late native playback after stop", async () => {
    const { media, controller } = setup({}, true);
    let resolvePlay: (() => void) | undefined;
    media.play.mockImplementation(() => new Promise<void>((resolve) => { resolvePlay = resolve; }));
    const result = controller.play();
    await flush();
    controller.stop();
    expect(await result).toEqual({ status: "cancelled" });
    media.paused = false;
    resolvePlay?.();
    await flush();
    expect(media.paused).toBe(true);
    expect(controller.getSnapshot().state).toBe("stopped");
  });

  it("does not let an old play promise pause a newer confirmed resume", async () => {
    const { media, controller } = setup({}, true);
    let resolveOld: (() => void) | undefined;
    media.play.mockImplementationOnce(() => new Promise<void>((resolve) => { resolveOld = resolve; }));
    const old = controller.play();
    await flush();
    controller.pause();
    expect(await old).toEqual({ status: "cancelled" });
    const resumed = controller.play();
    await flush();
    media.receive("playing");
    expect((await resumed).status).toBe("playing");
    resolveOld?.();
    await flush();
    expect(media.paused).toBe(false);
    expect(controller.getSnapshot().state).toBe("playing");
  });

  it("ignores a queued native pause event after a newer resume has started", async () => {
    const { media, controller } = setup({}, true);
    const first = controller.play();
    await flush();
    media.receive("playing");
    await first;
    controller.pause();
    const resumed = controller.play();
    await flush();
    media.receive("pause");
    media.receive("playing");
    expect((await resumed).status).toBe("playing");
    expect(media.paused).toBe(false);
  });
});
