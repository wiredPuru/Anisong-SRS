export type ManagedPlaybackRole = "foreground" | "standby" | "tail";
export type ManagedPlaybackState = "idle" | "loading" | "ready" | "playing" | "paused" | "buffering" | "ended" | "blocked" | "failed" | "stopped";

export interface ManagedMediaElement extends EventTarget {
  readonly readyState: number;
  readonly duration: number;
  readonly seeking: boolean;
  readonly paused: boolean;
  readonly error: { code: number } | null;
  currentTime: number;
  preload: string;
  muted: boolean;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  load(): void;
  play(): Promise<void>;
  pause(): void;
}

export interface ManagedPlaybackSnapshot {
  presentationId: number;
  role: ManagedPlaybackRole;
  state: ManagedPlaybackState;
  currentTime: number;
  duration: number | null;
  startOffset: number | null;
  seeking: boolean;
  ready: boolean;
}

export type ManagedPlaybackFailure =
  | { status: "cancelled" }
  | { status: "blocked" }
  | { status: "failed"; reason: "source" | "start-offset" | "media" | "playback" | "timeout" };

export type ManagedPlaybackResult<T extends "ready" | "playing"> =
  | { status: T; snapshot: ManagedPlaybackSnapshot }
  | ManagedPlaybackFailure;

export interface ManagedPlaybackOptions {
  presentationId: number;
  role: ManagedPlaybackRole;
  startAt?: (duration: number | null) => number;
  onChange?: (snapshot: ManagedPlaybackSnapshot) => void;
}

const OPERATION_TIMEOUT_MS = 30_000;

export function createManagedPlayback(element: ManagedMediaElement, options: ManagedPlaybackOptions) {
  let role = options.role;
  let state: ManagedPlaybackState = "idle";
  let startOffset: number | null = null;
  let seekPending = false;
  let preparing = false;
  let wanted = false;
  let stopped = false;
  let generation = 0;
  let failure: ManagedPlaybackFailure | null = null;
  let playRequest: Promise<ManagedPlaybackResult<"playing">> | null = null;
  const checks = new Set<() => void>();

  function getSnapshot(): ManagedPlaybackSnapshot {
    return {
      presentationId: options.presentationId, role, state,
      currentTime: Number.isFinite(element.currentTime) ? Math.max(0, element.currentTime) : 0,
      duration: Number.isFinite(element.duration) && element.duration > 0 ? element.duration : null,
      startOffset, seeking: element.seeking || seekPending,
      ready: !stopped && failure === null && !element.error && startOffset !== null
        && !seekPending && !element.seeking && element.readyState >= 3,
    };
  }

  function publish() {
    for (const check of [...checks]) check();
    options.onChange?.(getSnapshot());
  }

  function fail(result: ManagedPlaybackFailure) {
    failure = result;
    wanted = false;
    state = result.status === "blocked" ? "blocked" : result.status === "cancelled" ? "paused" : "failed";
    element.pause();
    publish();
  }

  function refresh() {
    if (stopped || !preparing || failure) return;
    if (element.error) return fail({ status: "failed", reason: "media" });
    if (startOffset === null && element.readyState >= 1) {
      try {
        const offset = options.startAt?.(getSnapshot().duration) ?? 0;
        if (!Number.isFinite(offset) || offset < 0
          || (Number.isFinite(element.duration) && element.duration > 0 && offset >= element.duration)) {
          return fail({ status: "failed", reason: "start-offset" });
        }
        startOffset = offset;
        if (Math.abs(element.currentTime - offset) > 0.01) {
          seekPending = true;
          element.currentTime = offset;
        }
      } catch {
        return fail({ status: "failed", reason: "start-offset" });
      }
    }
    if (getSnapshot().ready && (state === "loading" || state === "idle")) state = "ready";
    publish();
  }

  function waitFor<T extends "ready" | "playing">(target: T, token: number): Promise<ManagedPlaybackResult<T>> {
    return new Promise((resolve) => {
      const finish = (result: ManagedPlaybackResult<T>) => {
        clearTimeout(timeout);
        checks.delete(check);
        resolve(result);
      };
      const check = () => {
        if (stopped || token !== generation) finish({ status: "cancelled" });
        else if (failure) finish(failure);
        else if (target === "ready" ? getSnapshot().ready : state === "playing") {
          finish({ status: target, snapshot: getSnapshot() });
        }
      };
      const timeout = setTimeout(() => fail({ status: "failed", reason: "timeout" }), OPERATION_TIMEOUT_MS);
      checks.add(check);
      check();
    });
  }

  function prepare(): Promise<ManagedPlaybackResult<"ready">> {
    if (stopped) return Promise.resolve({ status: "cancelled" });
    if (failure?.status === "failed") return Promise.resolve(failure);
    failure = null;
    if (!preparing) {
      if (!element.getAttribute("src")) {
        fail({ status: "failed", reason: "source" });
        return Promise.resolve({ status: "failed", reason: "source" });
      }
      preparing = true;
      state = "loading";
      element.preload = "auto";
      try {
        if (element.readyState === 0) element.load();
      } catch {
        fail({ status: "failed", reason: "media" });
      }
    }
    refresh();
    return waitFor("ready", generation);
  }

  async function start(token: number): Promise<ManagedPlaybackResult<"playing">> {
    const prepared = await prepare();
    if (token !== generation || stopped) return { status: "cancelled" };
    if (prepared.status !== "ready") return prepared;
    wanted = true;
    const result = waitFor("playing", token);
    try {
      element.play().then(() => {
        if (stopped || !wanted) element.pause();
      }, (error: unknown) => {
        if (token !== generation || stopped) return;
        const name = error instanceof Error ? error.name : "";
        fail(name === "NotAllowedError" ? { status: "blocked" }
          : name === "AbortError" ? { status: "cancelled" } : { status: "failed", reason: "playback" });
      });
    } catch {
      fail({ status: "failed", reason: "playback" });
    }
    return result;
  }

  function play(): Promise<ManagedPlaybackResult<"playing">> {
    if (stopped) return Promise.resolve({ status: "cancelled" });
    if (playRequest) return playRequest;
    if (state === "playing") return Promise.resolve({ status: "playing", snapshot: getSnapshot() });
    const request = start(generation);
    playRequest = request;
    void request.finally(() => { if (playRequest === request) playRequest = null; });
    return request;
  }

  function pause() {
    if (stopped) return;
    generation += 1;
    wanted = false;
    playRequest = null;
    element.pause();
    state = "paused";
    publish();
  }

  const handlers: Record<string, () => void> = {
    loadedmetadata: refresh, durationchange: refresh, loadeddata: refresh, canplay: refresh,
    seeked: () => { seekPending = false; refresh(); },
    playing: () => {
      if (!wanted || stopped) return element.pause();
      if (!getSnapshot().ready) return;
      state = "playing";
      publish();
    },
    waiting: () => { state = "buffering"; publish(); },
    stalled: () => { state = "buffering"; publish(); },
    pause: () => {
      if (failure || !element.paused) return;
      if (wanted) { generation += 1; wanted = false; playRequest = null; }
      state = "paused";
      publish();
    },
    ended: () => {
      if (!wanted) return;
      generation += 1;
      wanted = false;
      playRequest = null;
      state = "ended";
      publish();
    },
    error: () => fail({ status: "failed", reason: "media" }),
    timeupdate: publish,
  };
  for (const [event, handler] of Object.entries(handlers)) element.addEventListener(event, handler);

  function stop() {
    if (stopped) return;
    stopped = true;
    generation += 1;
    wanted = false;
    state = "stopped";
    element.muted = true;
    for (const [event, handler] of Object.entries(handlers)) element.removeEventListener(event, handler);
    element.pause();
    element.removeAttribute("src");
    element.load();
    publish();
  }

  function setRole(next: ManagedPlaybackRole) {
    if (stopped) return;
    role = next;
    publish();
  }

  return { prepare, play, pause, stop, setRole, getSnapshot };
}
