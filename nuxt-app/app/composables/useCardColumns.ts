import { clampSongShare, DEFAULT_SONG_SHARE, parseStoredSongShare, songShareFromPointer } from "~/utils/cardColumns";

const STORAGE_KEY = "gaqSrs:cardColumns";

interface TextArea {
  songLeft: number;
  width: number;
  gap: number;
}

/** Drag-to-resize state for the Song / Anime split in the cards table header. */
export function useCardColumns() {
  const headRef = ref<HTMLElement | null>(null);
  const share = ref(DEFAULT_SONG_SHARE);
  const areaWidth = ref(0);
  const dragging = ref(false);

  // The stored share is kept as dragged; only what is rendered is clamped, so a
  // temporarily narrow table does not permanently shrink a wide preference.
  const effectiveShare = computed(() =>
    areaWidth.value > 0 ? clampSongShare(share.value, areaWidth.value) : share.value,
  );

  const columnVars = computed(() => ({
    "--song-fr": `${effectiveShare.value * 100}fr`,
    "--anime-fr": `${(1 - effectiveShare.value) * 100}fr`,
  }));

  function measure(): TextArea | null {
    const head = headRef.value;
    const song = head?.querySelector<HTMLElement>(".col-song");
    const anime = head?.querySelector<HTMLElement>(".col-anime");
    if (!head || !song || !anime) return null;
    const gap = parseFloat(getComputedStyle(head).columnGap) || 0;
    const songLeft = song.getBoundingClientRect().left;
    return { songLeft, width: anime.getBoundingClientRect().right - songLeft - gap, gap };
  }

  function onPointerMove(event: PointerEvent) {
    const area = measure();
    if (!area) return;
    // The divider sits in the middle of the gap between the two columns.
    share.value = songShareFromPointer(event.clientX - area.gap / 2, area.songLeft, area.width);
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
    share.value = DEFAULT_SONG_SHARE;
    persist();
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, String(share.value));
    } catch {
      // Storage unavailable - the split still applies for this visit.
    }
  }

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    try {
      share.value = parseStoredSongShare(localStorage.getItem(STORAGE_KEY));
    } catch {
      // Storage unavailable - start from the default.
    }
    if (headRef.value) {
      observer = new ResizeObserver(() => {
        areaWidth.value = measure()?.width ?? 0;
      });
      observer.observe(headRef.value);
    }
  });

  onBeforeUnmount(() => observer?.disconnect());

  return { headRef, columnVars, dragging, onPointerDown, reset };
}
