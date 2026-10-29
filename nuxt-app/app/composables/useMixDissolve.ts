import { onScopeDispose, ref, watch, type Ref } from "vue";
import { dissolveOpacity } from "../utils/listenMix";
import type { GainCurve } from "../utils/mediaGain";

/**
 * The incoming picture's opacity while a Mix overlap runs, or null when there
 * is nothing to dissolve (no overlap, Dissolve off, or reduced motion). One
 * animation frame per tick, and only while it is needed.
 */
export function useMixDissolve(options: {
  active: Ref<boolean>;
  enabled: Ref<boolean>;
  curve: Ref<GainCurve>;
  progress: () => number | null;
}) {
  const opacity = ref<number | null>(null);
  let frame: number | null = null;

  const reducedMotion = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function stop() {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    opacity.value = null;
  }

  function tick() {
    const progress = options.progress();
    if (progress === null || !options.enabled.value || reducedMotion()) {
      stop();
      return;
    }
    opacity.value = dissolveOpacity(progress, options.curve.value);
    frame = requestAnimationFrame(tick);
  }

  watch([options.active, options.enabled], ([active, enabled]) => {
    stop();
    if (active && enabled && typeof requestAnimationFrame === "function") tick();
  });

  onScopeDispose(stop);

  return opacity;
}
