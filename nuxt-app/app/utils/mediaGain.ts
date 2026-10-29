export interface GainParameter {
  cancelScheduledValues(time: number): unknown;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, endTime: number): unknown;
}

export interface GainSnapshot {
  value: number;
  target: number;
  remaining: number;
  held: boolean;
}

/** Smooth is equal power: the pair of fades keeps a steady combined loudness. */
export type GainCurve = "linear" | "smooth";

const SMOOTH_SEGMENTS = 32;

function curveFraction(curve: GainCurve, progress: number, rising: boolean): number {
  if (curve === "linear") return progress;
  const angle = progress * Math.PI / 2;
  return rising ? Math.sin(angle) : 1 - Math.cos(angle);
}

const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Controls a temporary envelope independently of the user's volume preference. */
export function createMediaGain(parameter: GainParameter, now: () => number, initial = 1) {
  let from = bounded(initial);
  let target = from;
  let started = now();
  let seconds = 0;
  let curve: GainCurve = "linear";
  let held = false;
  let stopped = false;

  function snapshot(): GainSnapshot {
    const elapsed = held ? 0 : Math.max(0, now() - started);
    const progress = seconds > 0 ? Math.min(1, elapsed / seconds) : 1;
    const value = progress >= 1 ? target : from + (target - from) * curveFraction(curve, progress, target >= from);
    return { value, target,
      remaining: Math.max(0, seconds - elapsed), held };
  }

  function schedule(value: number, duration: number, startValue = snapshot().value, shape = curve) {
    from = startValue;
    curve = shape;
    target = bounded(value);
    seconds = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    started = now();
    held = false;
    parameter.cancelScheduledValues(started);
    parameter.setValueAtTime(seconds > 0 ? from : target, started);
    if (seconds <= 0) return;
    if (curve === "linear") {
      parameter.linearRampToValueAtTime(target, started + seconds);
      return;
    }
    const rising = target >= from;
    for (let step = 1; step <= SMOOTH_SEGMENTS; step += 1) {
      const progress = step / SMOOTH_SEGMENTS;
      const value = step === SMOOTH_SEGMENTS ? target : from + (target - from) * curveFraction(curve, progress, rising);
      parameter.linearRampToValueAtTime(value, started + seconds * progress);
    }
  }

  schedule(from, 0);
  return {
    getSnapshot: snapshot,
    ramp(value: number, duration: number, shape: GainCurve = "linear") {
      if (!stopped) schedule(value, duration, undefined, shape);
    },
    hold() {
      if (stopped || held) return;
      const current = snapshot();
      from = current.value;
      seconds = current.remaining;
      held = true;
      parameter.cancelScheduledValues(now());
      parameter.setValueAtTime(from, now());
    },
    resume() {
      if (!stopped && held) schedule(target, seconds, from);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      from = target = 0;
      seconds = 0;
      held = false;
      parameter.cancelScheduledValues(now());
      parameter.setValueAtTime(0, now());
    },
  };
}
