import { clampInspectorWidth, INSPECTOR_DEFAULT_WIDTH } from "~/utils/paneWidth";

const STORAGE_KEY = "gaqSrs:cardsInspectorWidth";

/** Drag-to-resize state for a right-hand pane whose width is measured from the container's right edge. */
export function useResizablePane() {
  const containerRef = ref<HTMLElement | null>(null);
  const width = ref(INSPECTOR_DEFAULT_WIDTH);
  const dragging = ref(false);

  function containerWidth() {
    return containerRef.value?.clientWidth ?? window.innerWidth;
  }

  function setWidth(requested: number) {
    width.value = clampInspectorWidth(requested, containerWidth());
  }

  function onPointerMove(event: PointerEvent) {
    const rect = containerRef.value?.getBoundingClientRect();
    if (!rect) return;
    setWidth(rect.right - event.clientX);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    dragging.value = true;
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener(
      // Fires on pointerup and on a cancelled drag alike.
      "lostpointercapture",
      () => {
        handle.removeEventListener("pointermove", onPointerMove);
        dragging.value = false;
        persist();
      },
      { once: true },
    );
  }

  function reset() {
    setWidth(INSPECTOR_DEFAULT_WIDTH);
    persist();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, String(width.value));
    } catch {
      // Storage unavailable - the width still applies for this visit.
    }
  }

  function onWindowResize() {
    setWidth(width.value);
  }

  onMounted(() => {
    let stored = INSPECTOR_DEFAULT_WIDTH;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) stored = Number(raw);
    } catch {
      // Storage unavailable - start from the default.
    }
    setWidth(stored);
    window.addEventListener("resize", onWindowResize);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("resize", onWindowResize);
  });

  return { containerRef, width, dragging, onPointerDown, reset };
}
