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

const bounded = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;

/** Controls a temporary envelope independently of the user's volume preference. */
export function createMediaGain(parameter: GainParameter, now: () => number, initial = 1) {
  let from = bounded(initial);
  let target = from;
  let started = now();
  let seconds = 0;
  let held = false;
  let stopped = false;

  function snapshot(): GainSnapshot {
    const elapsed = held ? 0 : Math.max(0, now() - started);
    const progress = seconds > 0 ? Math.min(1, elapsed / seconds) : 1;
    return { value: from + (target - from) * progress, target,
      remaining: Math.max(0, seconds - elapsed), held };
  }

  function schedule(value: number, duration: number, startValue = snapshot().value) {
    from = startValue;
    target = bounded(value);
    seconds = Number.isFinite(duration) ? Math.max(0, duration) : 0;
    started = now();
    held = false;
    parameter.cancelScheduledValues(started);
    parameter.setValueAtTime(seconds > 0 ? from : target, started);
    if (seconds > 0) parameter.linearRampToValueAtTime(target, started + seconds);
  }

  schedule(from, 0);
  return {
    getSnapshot: snapshot,
    ramp(value: number, duration: number) { if (!stopped) schedule(value, duration); },
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
