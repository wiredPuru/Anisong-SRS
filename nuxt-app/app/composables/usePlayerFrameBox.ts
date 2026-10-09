import type { Ref } from "vue";

/**
 * Where the player frame sits inside its pane, as CSS variables, so the Now
 * playing bar can match the picture's width and the details card can cover it
 * exactly. The frame keeps 16:9 inside whatever height is left, which CSS
 * alone cannot hand to a sibling.
 */
export function usePlayerFrameBox(paneRef: Ref<HTMLElement | null>, presentationKey: Ref<unknown>) {
  const box = ref<{ top: number; left: number; width: number; height: number } | null>(null);
  let observer: ResizeObserver | null = null;

  function measure() {
    const pane = paneRef.value;
    const frame = pane?.querySelector(".player-frame");
    if (!pane || !frame) return;
    const outer = pane.getBoundingClientRect();
    const inner = frame.getBoundingClientRect();
    box.value = { top: inner.top - outer.top, left: inner.left - outer.left, width: inner.width, height: inner.height };
  }

  // The player remounts per card, so its frame is a new element to watch.
  function observeFrame() {
    const frame = paneRef.value?.querySelector(".player-frame");
    if (frame) observer?.observe(frame);
    measure();
  }

  watch(paneRef, (pane) => {
    observer?.disconnect();
    observer = null;
    if (!pane || typeof ResizeObserver === "undefined") return;
    observer = new ResizeObserver(measure);
    observer.observe(pane);
    nextTick(observeFrame);
  });

  watch(presentationKey, () => nextTick(observeFrame));

  onUnmounted(() => observer?.disconnect());

  return computed(() =>
    box.value
      ? {
          "--frame-top": `${box.value.top}px`,
          "--frame-left": `${box.value.left}px`,
          "--frame-w": `${box.value.width}px`,
          "--frame-h": `${box.value.height}px`,
        }
      : undefined,
  );
}
