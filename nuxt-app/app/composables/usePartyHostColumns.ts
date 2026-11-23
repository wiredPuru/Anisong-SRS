import {
  clampShares,
  DEFAULT_COLUMN_SHARES,
  moveDivider,
  parseStoredShares,
  type ColumnShares,
} from "~/utils/partyHostColumns";

const STORAGE_KEY = "gaqSrs:partyHostColumns";
/** Width of each divider track in the host grid; must match the CSS. */
export const HOST_DIVIDER_PX = 16;

/** Drag-to-resize widths for the party host's three columns. */
export function usePartyHostColumns() {
  const gridRef = ref<HTMLElement | null>(null);
  const shares = ref<ColumnShares>([...DEFAULT_COLUMN_SHARES]);
  const areaWidth = ref(0);
  const dragging = ref<0 | 1 | null>(null);

  // The stored layout is kept as dragged; only what renders is clamped, so a
  // briefly narrow window does not permanently squash a wide column.
  const effective = computed(() => (areaWidth.value > 0 ? clampShares(shares.value, areaWidth.value) : shares.value));

  const columnVars = computed(() => ({
    "--col-a": `${effective.value[0] * 100}fr`,
    "--col-b": `${effective.value[1] * 100}fr`,
    "--col-c": `${effective.value[2] * 100}fr`,
  }));

  function measure() {
    const grid = gridRef.value;
    if (!grid || !grid.clientWidth) return null;
    const rect = grid.getBoundingClientRect();
    // On a 4K screen the dashboard is CSS-zoomed, so pointer and rect are in
    // screen pixels while the divider width is in the grid's own pixels.
    const divider = HOST_DIVIDER_PX * (rect.width / grid.clientWidth);
    return { left: rect.left, width: rect.width - divider * 2, divider };
  }

  function onPointerDown(divider: 0 | 1, event: PointerEvent) {
    if (event.button !== 0) return;
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);
    // Start from what is on screen, so a clamped layout does not jump on the first move.
    shares.value = effective.value;
    dragging.value = divider;
    const onMove = (move: PointerEvent) => {
      const area = measure();
      if (!area) return;
      const x = move.clientX - area.left - area.divider * divider - area.divider / 2;
      shares.value = moveDivider(shares.value, divider, x, area.width);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener(
      // Fires on pointerup and on a cancelled drag alike.
      "lostpointercapture",
      () => {
        handle.removeEventListener("pointermove", onMove);
        dragging.value = null;
        persist();
      },
      { once: true },
    );
  }

  function reset() {
    shares.value = [...DEFAULT_COLUMN_SHARES];
    persist();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shares.value));
    } catch {
      // Storage unavailable - the widths still apply for this visit.
    }
  }

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    try {
      shares.value = parseStoredShares(localStorage.getItem(STORAGE_KEY));
    } catch {
      // Storage unavailable - start equal.
    }
    if (gridRef.value) {
      observer = new ResizeObserver(() => {
        areaWidth.value = measure()?.width ?? 0;
      });
      observer.observe(gridRef.value);
    }
  });

  onBeforeUnmount(() => observer?.disconnect());

  return { gridRef, columnVars, dragging, onPointerDown, reset };
}
