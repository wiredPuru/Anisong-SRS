import { onScopeDispose, ref, shallowRef } from "vue";
import type { CardWithDetails } from "./useStudySession";
import { MIN_LISTEN_MIX_SECONDS, planListenMix, remainingListenSeconds } from "../utils/listenMix";
import type { GainCurve } from "../utils/mediaGain";
import type { ManagedPlaybackResult, ManagedPlaybackRole, ManagedPlaybackSnapshot } from "../utils/managedPlayback";

export interface ListenPlayerPort {
  prepare(): Promise<ManagedPlaybackResult<"ready">>;
  play(): Promise<ManagedPlaybackResult<"playing">>;
  pause(): void;
  stop(): void;
  getSnapshot(): ManagedPlaybackSnapshot | null;
  prepareGain(): Promise<boolean>;
  rampGain(value: number, seconds: number, curve?: GainCurve): boolean;
  holdGain(): void;
  resumeGain(): void;
}
export interface ListenSlot {
  id: number;
  card: CardWithDetails;
  role: ManagedPlaybackRole;
  origin: ManagedPlaybackRole;
  audioOnly: boolean;
  randomStart: boolean;
  playLength: number;
}
export interface ListenPlaybackSettings {
  mix: boolean;
  autoplay: boolean;
  audioOnly: boolean;
  randomStart: boolean;
  playLength: number;
  mixSeconds: number;
  mixCurve: GainCurve;
}
export interface ListenPresentation {
  key: number;
  queue: number;
  card: CardWithDetails | null;
  nextCard: CardWithDetails | null;
}

const POLL_MS = 250;
const DEAD_STATES = new Set(["ended", "failed", "stopped", "blocked"]);

interface Overlap {
  tailId: number;
  endsAt: number;
  // Set while the overlap is paused; the fade resumes with this much left.
  remainingMs: number | null;
  timer: ReturnType<typeof setTimeout> | null;
}

export function useListenPlayback(options: {
  advance: () => void;
  onForeground?: (snapshot: ManagedPlaybackSnapshot) => void;
  // Seconds left of the play-length budget, or null when the full song plays.
  playLengthRemaining?: () => number | null;
}) {
  const slots = shallowRef<ListenSlot[]>([]);
  const snapshots = new Map<number, ManagedPlaybackSnapshot>();
  const ports = new Map<number, ListenPlayerPort>();
  const attempted = new Set<number>();
  let sequence = 0;
  let generation = 0;
  let disposed = false;
  let attempting = false;
  let handoffPending = false;
  let overlap: Overlap | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let presentation: ListenPresentation | null = null;
  // Decided once per presentation: toggling Mix mid-song never swaps the mounted
  // player, it only changes what happens at the next boundary.
  const managedMode = ref(false);
  let settings: ListenPlaybackSettings = { mix: false, autoplay: false, audioOnly: false, randomStart: false, playLength: 0, mixSeconds: 5, mixCurve: "linear" };

  const foreground = () => slots.value.find((s) => s.role === "foreground");
  const standby = () => slots.value.find((s) => s.role === "standby");
  const currentPort = () => { const slot = foreground(); return slot ? ports.get(slot.id) : undefined; };
  const snap = (id: number) => ports.get(id)?.getSnapshot() ?? snapshots.get(id) ?? null;

  function retire(id: number) {
    ports.get(id)?.stop();
    ports.delete(id);
    snapshots.delete(id);
    attempted.delete(id);
    slots.value = slots.value.filter((s) => s.id !== id);
  }
  function cancelPending() {
    generation += 1;
    attempting = false;
  }
  function clearOverlap() {
    if (overlap?.timer) clearTimeout(overlap.timer);
    overlap = null;
  }
  function stopPolling() {
    if (poll !== null) clearInterval(poll);
    poll = null;
  }
  function stop() {
    cancelPending();
    clearOverlap();
    handoffPending = false;
    for (const slot of [...slots.value]) retire(slot.id);
  }
  function settle() {
    cancelPending();
    clearOverlap();
    for (const slot of [...slots.value]) if (slot.role !== "foreground") retire(slot.id);
    currentPort()?.rampGain(1, 0);
  }
  function allocate(card: CardWithDetails, role: ManagedPlaybackRole) {
    const slot: ListenSlot = { id: ++sequence, card, role, origin: role, audioOnly: settings.audioOnly,
      randomStart: settings.randomStart, playLength: settings.autoplay ? settings.playLength : 0 };
    slots.value = [...slots.value, slot];
  }
  function stageNext() {
    if (!managedMode.value || !settings.mix || !settings.autoplay || !presentation?.nextCard
      || slots.value.length !== 1 || !foreground()) return;
    allocate(presentation.nextCard, "standby");
  }

  // The fade ended, or something made it unsafe to continue: drop the tail and
  // leave the committed song alone at full volume.
  function endOverlap() {
    if (!overlap) return;
    const id = overlap.tailId;
    clearOverlap();
    retire(id);
    currentPort()?.rampGain(1, 0);
    stageNext();
  }

  function commit(out: ListenSlot, incoming: ListenSlot, seconds: number) {
    const outPort = ports.get(out.id);
    const inPort = ports.get(incoming.id);
    slots.value = slots.value.map((s) => s.id === incoming.id ? { ...s, role: "foreground" as const }
      : s.id === out.id ? { ...s, role: "tail" as const } : s);
    handoffPending = true;
    inPort?.rampGain(1, seconds, settings.mixCurve);
    outPort?.rampGain(0, seconds, settings.mixCurve);
    overlap = { tailId: out.id, endsAt: Date.now() + seconds * 1000, remainingMs: null,
      timer: setTimeout(endOverlap, seconds * 1000) };
    options.advance();
  }

  function remainingSeconds(id: number) {
    const s = snap(id);
    if (!s) return null;
    return remainingListenSeconds({ duration: s.duration, currentTime: s.currentTime,
      playLengthRemaining: options.playLengthRemaining?.() ?? null });
  }

  async function begin(out: ListenSlot, incoming: ListenSlot, seconds: number) {
    const token = generation;
    attempting = true;
    attempted.add(out.id);
    const outPort = ports.get(out.id);
    const inPort = ports.get(incoming.id);
    if (!outPort || !inPort) { attempting = false; return; }
    const ready = await Promise.all([outPort.prepareGain(), inPort.prepareGain()]);
    if (disposed || token !== generation) return;
    if (!ready.every(Boolean)) { attempting = false; return; }
    inPort.rampGain(0, 0);
    const result = await inPort.play();
    if (disposed || token !== generation) return;
    attempting = false;
    if (result.status !== "playing") { retire(incoming.id); return; }
    const left = remainingSeconds(out.id);
    const actual = left === null ? seconds : Math.min(seconds, left);
    if (actual < MIN_LISTEN_MIX_SECONDS) { retire(incoming.id); return; }
    commit(out, incoming, actual);
  }

  function maybeBegin() {
    if (!managedMode.value || !settings.mix || !settings.autoplay || attempting || handoffPending) return;
    const out = foreground();
    const incoming = standby();
    if (!out || !incoming || attempted.has(out.id)) return;
    const outSnap = snap(out.id);
    const inSnap = snap(incoming.id);
    if (!outSnap || outSnap.state !== "playing") return;
    const left = remainingSeconds(out.id);
    if (left === null || left > settings.mixSeconds) return;
    if (!inSnap?.ready) { attempted.add(out.id); return; }
    const seconds = planListenMix({
      enabled: true,
      autoplay: true,
      targetSeconds: settings.mixSeconds,
      outgoing: { duration: outSnap.duration, startOffset: outSnap.startOffset ?? 0, playLength: out.playLength },
      incoming: { duration: inSnap.duration, startOffset: inSnap.startOffset ?? 0, playLength: incoming.playLength },
    });
    if (seconds === 0) { attempted.add(out.id); return; }
    if (left > seconds) return;
    void begin(out, incoming, Math.min(seconds, left));
  }

  function watchOverlap() {
    if (!overlap || overlap.remainingMs !== null) return;
    if (Date.now() >= overlap.endsAt) { endOverlap(); return; }
    const fg = foreground();
    const tail = snap(overlap.tailId);
    const lead = fg ? snap(fg.id) : null;
    if (!tail || DEAD_STATES.has(tail.state) || !lead || lead.seeking
      || lead.state === "buffering" || DEAD_STATES.has(lead.state)) endOverlap();
  }

  function tick() {
    if (disposed) return;
    if (overlap) watchOverlap();
    else maybeBegin();
  }
  function ensurePolling() {
    if (poll === null && managedMode.value) poll = setInterval(tick, POLL_MS);
  }

  function synchronize(next: ListenPresentation) {
    if (disposed) return;
    if (handoffPending && next.card && foreground()?.card.id === next.card.id && presentation?.queue === next.queue) {
      handoffPending = false;
      presentation = next;
      stageNext();
      return;
    }
    if (presentation?.key === next.key && presentation.queue === next.queue && foreground()?.card.id === next.card?.id) {
      presentation = next;
      stageNext();
      return;
    }
    stop();
    presentation = next;
    managedMode.value = settings.mix && settings.autoplay;
    if (next.card) allocate(next.card, "foreground");
    stageNext();
    if (managedMode.value) ensurePolling(); else stopPolling();
  }
  function configure(next: ListenPlaybackSettings) {
    const changed = JSON.stringify(settings) !== JSON.stringify(next);
    settings = { ...next };
    if (changed) { settle(); stageNext(); }
  }
  async function attach(id: number, port: ListenPlayerPort | null) {
    if (!port || !slots.value.some((s) => s.id === id) || ports.has(id)) return;
    ports.set(id, port);
    const token = generation;
    const result = await port.prepare();
    if (disposed || token !== generation || ports.get(id) !== port) return;
    if (result.status === "ready" && foreground()?.id === id && settings.autoplay) await port.play();
  }
  function report(id: number, snapshot: ManagedPlaybackSnapshot) {
    if (disposed || !slots.value.some((s) => s.id === id)) return;
    snapshots.set(id, snapshot);
    if (foreground()?.id === id) options.onForeground?.(snapshot);
  }

  // The visible player was paused: an unconfirmed incoming start is cancelled,
  // and a running fade freezes with its tail until playback resumes.
  function foregroundPaused() {
    if (overlap && overlap.remainingMs === null) {
      const tail = ports.get(overlap.tailId);
      tail?.pause();
      tail?.holdGain();
      overlap.remainingMs = Math.max(0, overlap.endsAt - Date.now());
      if (overlap.timer) clearTimeout(overlap.timer);
      overlap.timer = null;
      return;
    }
    if (attempting) {
      cancelPending();
      const out = foreground();
      if (out) attempted.delete(out.id);
      const incoming = standby();
      if (incoming) ports.get(incoming.id)?.pause();
    }
  }
  async function foregroundResumed() {
    if (!overlap || overlap.remainingMs === null) return;
    const live = overlap;
    const tail = ports.get(live.tailId);
    const result = await tail?.play();
    if (overlap !== live || live.remainingMs === null) return;
    if (result?.status !== "playing") { endOverlap(); return; }
    tail?.resumeGain();
    live.endsAt = Date.now() + live.remainingMs;
    live.timer = setTimeout(endOverlap, live.remainingMs);
    live.remainingMs = null;
  }

  function pause() { currentPort()?.pause(); }
  async function play() { return currentPort()?.play(); }
  function dispose() { if (disposed) return; disposed = true; stopPolling(); stop(); }
  onScopeDispose(dispose);
  return { slots, managedMode, synchronize, configure, attach, report, settle, pause, play, stop, dispose,
    foregroundPaused, foregroundResumed,
    getSnapshot: () => { const slot = foreground(); return slot ? snapshots.get(slot.id) ?? null : null; } };
}
