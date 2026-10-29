import { effectScope } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useListenPlayback, type ListenPlayerPort } from "./useListenPlayback";
import type { CardWithDetails } from "./useStudySession";
import type { ManagedPlaybackResult, ManagedPlaybackSnapshot } from "../utils/managedPlayback";

const card = (id: number) => ({ id }) as CardWithDetails;
const snapshot = (id: number): ManagedPlaybackSnapshot => ({ presentationId: id, role: "foreground", state: "ready", ready: true,
  currentTime: 0, duration: 60, startOffset: 0, seeking: false });
function port(id: number): ListenPlayerPort {
  const state = snapshot(id);
  return { prepare: vi.fn(async () => ({ status: "ready", snapshot: state })),
    play: vi.fn(async () => ({ status: "playing", snapshot: { ...state, state: "playing" } })),
    pause: vi.fn(), stop: vi.fn(), getSnapshot: () => state,
    prepareGain: vi.fn(async () => true), rampGain: vi.fn(() => true), holdGain: vi.fn(), resumeGain: vi.fn() };
}
function setup(mix = true) {
  const scope = effectScope();
  const advance = vi.fn();
  const onForeground = vi.fn();
  const controller = scope.run(() => useListenPlayback({ advance, onForeground }))!;
  controller.configure({ mix, autoplay: true, audioOnly: false, randomStart: false, playLength: 30, mixSeconds: 5 });
  controller.synchronize({ key: 1, queue: 1, card: card(1), nextCard: card(2) });
  return { controller, advance, onForeground, scope };
}

describe("Listen slot ownership", () => {
  it("allocates only current and immediate next, and prepares standby without playing", async () => {
    const { controller, scope } = setup();
    const [a, b] = controller.slots.value;
    const first = port(a!.id), second = port(b!.id);
    await controller.attach(a!.id, first); await controller.attach(b!.id, second);
    expect(first.play).toHaveBeenCalledOnce();
    expect(second.prepare).toHaveBeenCalledOnce(); expect(second.play).not.toHaveBeenCalled();
    controller.synchronize({ key: 1, queue: 1, card: card(1), nextCard: card(2) });
    expect(controller.slots.value).toHaveLength(2);
    scope.stop(); expect(first.stop).toHaveBeenCalledOnce(); expect(second.stop).toHaveBeenCalledOnce();
  });
  it("uses one slot with Mix off and never stages beyond the last song", () => {
    const { controller, scope } = setup(false);
    expect(controller.slots.value).toHaveLength(1);
    controller.configure({ mix: true, autoplay: true, audioOnly: false, randomStart: false, playLength: 30, mixSeconds: 5 });
    controller.synchronize({ key: 2, queue: 1, card: card(2), nextCard: null });
    expect(controller.slots.value).toHaveLength(1); scope.stop();
  });
  it("keeps a presentation plain when Mix is turned on mid-song", () => {
    const { controller, scope } = setup(false);
    controller.configure({ mix: true, autoplay: true, audioOnly: false, randomStart: false, playLength: 30, mixSeconds: 5 });
    expect(controller.managedMode.value).toBe(false);
    expect(controller.slots.value).toHaveLength(1);
    controller.synchronize({ key: 2, queue: 1, card: card(2), nextCard: card(3) });
    expect(controller.managedMode.value).toBe(true);
    expect(controller.slots.value).toHaveLength(2); scope.stop();
  });
  it("retires the standby when Mix is turned off mid-song but keeps the foreground", () => {
    const { controller, scope } = setup();
    const keep = controller.slots.value[0]!.id;
    controller.configure({ mix: false, autoplay: true, audioOnly: false, randomStart: false, playLength: 30, mixSeconds: 5 });
    expect(controller.slots.value.map((s) => s.id)).toEqual([keep]); scope.stop();
  });
  it("rejects a late preparation result from a retired queue", async () => {
    const { controller, scope } = setup(); const id = controller.slots.value[0]!.id;
    const old = port(id); let resolve!: (r: ManagedPlaybackResult<"ready">) => void;
    old.prepare = () => new Promise(r => { resolve = r; });
    const pending = controller.attach(id, old);
    controller.synchronize({ key: 2, queue: 2, card: card(3), nextCard: card(4) });
    resolve({ status: "ready", snapshot: snapshot(id) }); await pending;
    expect(old.play).not.toHaveBeenCalled(); expect(old.stop).toHaveBeenCalledOnce(); scope.stop();
  });
  it("uses a new identity for another presentation of the same card", () => {
    const { controller, scope } = setup(); const id = controller.slots.value[0]!.id;
    controller.synchronize({ key: 2, queue: 1, card: card(1), nextCard: null });
    expect(controller.slots.value[0]!.id).not.toBe(id); scope.stop();
  });
  it("only forwards foreground telemetry and ignores retired ids", () => {
    const { controller, scope, onForeground } = setup(); const [a,b] = controller.slots.value;
    controller.report(b!.id, snapshot(b!.id)); expect(onForeground).not.toHaveBeenCalled();
    controller.report(a!.id, snapshot(a!.id)); expect(onForeground).toHaveBeenCalledOnce();
    controller.stop(); controller.report(a!.id, snapshot(a!.id)); expect(onForeground).toHaveBeenCalledOnce(); scope.stop();
  });
});

interface Live { port: ListenPlayerPort; state: ManagedPlaybackSnapshot; ramps: Array<[number, number]> }
function livePort(id: number, over: Partial<ManagedPlaybackSnapshot>): Live {
  const state: ManagedPlaybackSnapshot = { ...snapshot(id), ...over };
  const ramps: Array<[number, number]> = [];
  const port: ListenPlayerPort = {
    prepare: vi.fn(async () => ({ status: "ready", snapshot: state })),
    play: vi.fn(async () => { state.state = "playing"; return { status: "playing", snapshot: state }; }),
    pause: vi.fn(), stop: vi.fn(), getSnapshot: () => state,
    prepareGain: vi.fn(async () => true),
    rampGain: vi.fn((value: number, seconds: number) => { ramps.push([value, seconds]); return true; }),
    holdGain: vi.fn(), resumeGain: vi.fn(),
  };
  return { port, state, ramps };
}
async function mixSetup(playLengthRemaining: () => number | null = () => null, mixSeconds = 5) {
  vi.useFakeTimers();
  const scope = effectScope();
  const advance = vi.fn();
  const controller = scope.run(() => useListenPlayback({ advance, playLengthRemaining }))!;
  controller.configure({ mix: true, autoplay: true, audioOnly: false, randomStart: false, playLength: 0, mixSeconds });
  controller.synchronize({ key: 1, queue: 1, card: card(1), nextCard: card(2) });
  const [a, b] = controller.slots.value;
  const out = livePort(a!.id, { state: "playing", duration: 60 });
  const incoming = livePort(b!.id, { state: "ready", duration: 60 });
  await controller.attach(a!.id, out.port);
  await controller.attach(b!.id, incoming.port);
  return { controller, advance, out, incoming, a: a!, b: b!, scope };
}
const roles = (c: ReturnType<typeof useListenPlayback>) => c.slots.value.map((s) => s.role);

describe("Listen Mix handoff", () => {
  afterEach(() => vi.useRealTimers());

  it("waits outside the window, then overlaps once and retires the tail", async () => {
    const { controller, advance, out, incoming, scope } = await mixSetup();
    out.state.currentTime = 50;
    await vi.advanceTimersByTimeAsync(250);
    expect(incoming.port.play).not.toHaveBeenCalled();
    out.state.currentTime = 55;
    await vi.advanceTimersByTimeAsync(250);
    expect(incoming.port.play).toHaveBeenCalledOnce();
    expect(advance).toHaveBeenCalledOnce();
    expect(roles(controller)).toEqual(["tail", "foreground"]);
    expect(incoming.ramps).toEqual([[0, 0], [1, 5]]);
    expect(out.ramps).toEqual([[0, 5]]);
    await vi.advanceTimersByTimeAsync(250);
    expect(advance).toHaveBeenCalledOnce();
    controller.synchronize({ key: 2, queue: 1, card: card(2), nextCard: null });
    await vi.advanceTimersByTimeAsync(5000);
    expect(out.port.stop).toHaveBeenCalledOnce();
    expect(roles(controller)).toEqual(["foreground"]);
    scope.stop();
  });

  it("starts a 2 second overlap only when 2 seconds are left", async () => {
    const { advance, incoming, out, scope } = await mixSetup(() => null, 2);
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    expect(incoming.port.play).not.toHaveBeenCalled();
    out.state.currentTime = 58.5;
    await vi.advanceTimersByTimeAsync(250);
    expect(advance).toHaveBeenCalledOnce();
    expect(incoming.ramps).toEqual([[0, 0], [1, 1.5]]);
    scope.stop();
  });

  it("starts a 12 second overlap with 12 seconds left", async () => {
    const { advance, incoming, out, scope } = await mixSetup(() => null, 12);
    out.state.currentTime = 40;
    await vi.advanceTimersByTimeAsync(250);
    expect(incoming.port.play).not.toHaveBeenCalled();
    out.state.currentTime = 48;
    await vi.advanceTimersByTimeAsync(250);
    expect(advance).toHaveBeenCalledOnce();
    expect(incoming.ramps).toEqual([[0, 0], [1, 12]]);
    expect(out.ramps).toEqual([[0, 12]]);
    scope.stop();
  });

  it("re-stages the standby when the length changes mid-song", async () => {
    const { controller, b, scope } = await mixSetup();
    controller.configure({ mix: true, autoplay: true, audioOnly: false, randomStart: false, playLength: 0, mixSeconds: 8 });
    const standby = controller.slots.value.find((s) => s.role === "standby");
    expect(standby).toBeDefined();
    expect(standby!.id).not.toBe(b.id);
    scope.stop();
  });

  it("accepts the advanced presentation without tearing the promoted slot down", async () => {
    const { controller, incoming, b, out, scope } = await mixSetup();
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    controller.synchronize({ key: 2, queue: 1, card: card(2), nextCard: card(3) });
    expect(controller.slots.value.some((s) => s.id === b.id && s.role === "foreground")).toBe(true);
    expect(incoming.port.stop).not.toHaveBeenCalled();
    scope.stop();
  });

  it("falls back to ordinary advancement when the next clip is not ready", async () => {
    const { controller, advance, incoming, out, scope } = await mixSetup();
    incoming.state.ready = false;
    out.state.currentTime = 57;
    await vi.advanceTimersByTimeAsync(1000);
    expect(incoming.port.play).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
    expect(out.ramps).toEqual([]);
    expect(roles(controller)).toEqual(["foreground", "standby"]); scope.stop();
  });

  it("shortens the overlap to the remaining play-length budget", async () => {
    const { advance, incoming, out, scope } = await mixSetup(() => 3);
    out.state.currentTime = 10;
    await vi.advanceTimersByTimeAsync(250);
    expect(advance).toHaveBeenCalledOnce();
    expect(incoming.ramps).toEqual([[0, 0], [1, 3]]); scope.stop();
  });

  it("does not mix when the audio graph cannot be prepared", async () => {
    const { controller, advance, incoming, out, scope } = await mixSetup();
    vi.mocked(incoming.port.prepareGain).mockResolvedValue(false);
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(1000);
    expect(incoming.port.play).not.toHaveBeenCalled();
    expect(advance).not.toHaveBeenCalled();
    expect(out.ramps).toEqual([]);
    expect(roles(controller)).toEqual(["foreground", "standby"]); scope.stop();
  });

  it("cancels an unconfirmed start when the visible player is paused", async () => {
    const { controller, advance, incoming, out, scope } = await mixSetup();
    let finish!: (r: ManagedPlaybackResult<"playing">) => void;
    incoming.port.play = vi.fn(() => new Promise((r) => { finish = r; }));
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    controller.foregroundPaused();
    finish({ status: "playing", snapshot: incoming.state });
    await vi.advanceTimersByTimeAsync(0);
    expect(advance).not.toHaveBeenCalled();
    expect(incoming.port.pause).toHaveBeenCalled();
    expect(roles(controller)).toEqual(["foreground", "standby"]); scope.stop();
  });

  it("freezes the tail and the fade on pause and continues on resume", async () => {
    const { controller, out, scope } = await mixSetup();
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    controller.synchronize({ key: 2, queue: 1, card: card(2), nextCard: null });
    await vi.advanceTimersByTimeAsync(1000);
    controller.foregroundPaused();
    expect(out.port.pause).toHaveBeenCalled();
    expect(out.port.holdGain).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(roles(controller)).toEqual(["tail", "foreground"]);
    await controller.foregroundResumed();
    expect(out.port.resumeGain).toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(roles(controller)).toEqual(["tail", "foreground"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(roles(controller)).toEqual(["foreground"]); scope.stop();
  });

  it("drops the tail and restores full volume when the committed song is seeked", async () => {
    const { controller, incoming, out, scope } = await mixSetup();
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    controller.synchronize({ key: 2, queue: 1, card: card(2), nextCard: null });
    incoming.state.seeking = true;
    await vi.advanceTimersByTimeAsync(250);
    expect(out.port.stop).toHaveBeenCalledOnce();
    expect(incoming.ramps.at(-1)).toEqual([1, 0]);
    expect(roles(controller)).toEqual(["foreground"]); scope.stop();
  });

  it("settles to the committed song when Mix is turned off during the fade", async () => {
    const { controller, out, incoming, scope } = await mixSetup();
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    controller.configure({ mix: false, autoplay: true, audioOnly: false, randomStart: false, playLength: 0, mixSeconds: 5 });
    expect(out.port.stop).toHaveBeenCalledOnce();
    expect(incoming.ramps.at(-1)).toEqual([1, 0]);
    expect(roles(controller)).toEqual(["foreground"]); scope.stop();
  });

  it("ignores a Next during the fade by replacing the whole presentation", async () => {
    const { controller, out, incoming, scope } = await mixSetup();
    out.state.currentTime = 56;
    await vi.advanceTimersByTimeAsync(250);
    controller.synchronize({ key: 9, queue: 1, card: card(7), nextCard: null });
    expect(out.port.stop).toHaveBeenCalledOnce();
    expect(incoming.port.stop).toHaveBeenCalledOnce();
    expect(controller.slots.value).toHaveLength(1); scope.stop();
  });
});
