import { computed, onMounted, onScopeDispose, ref, watch, type Ref } from "vue";
import { parsePlayLength } from "../utils/listenPlayLength";

const STORAGE_KEY = "gaqSrs:listenPlayLength";

// /listen's play length: counts only time the clip is actually playing, then
// calls onExpire so the page can move on. Separate from the Auto Reveal timer
// on purpose; the two are independent settings.
export function useListenPlayLimit(enabled: Ref<boolean>, presentationKey: Ref<number>, onExpire: () => void) {
  const seconds = ref(0);
  const playing = ref(false);
  const active = computed(() => enabled.value && seconds.value > 0);
  // Re-read every 250ms while counting so the page can show when the song ends.
  const tick = ref(0);
  let ticker: ReturnType<typeof setInterval> | null = null;

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let armedAt = 0;
  let armedMs = 0;
  // Time left when a running countdown was paused; null means none is paused.
  let remainingMs: number | null = null;

  function stop() {
    if (timeout !== null) clearTimeout(timeout);
    timeout = null;
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
    tick.value += 1;
  }

  function arm(durationMs: number) {
    stop();
    armedAt = Date.now();
    armedMs = durationMs;
    ticker = setInterval(() => (tick.value += 1), 250);
    timeout = setTimeout(() => {
      stop();
      remainingMs = null;
      onExpire();
    }, durationMs);
  }

  // "playing" also fires after a buffering stall or a seek with no pause in
  // between, so a countdown that is already running must be left alone.
  function onPlaybackStarted() {
    playing.value = true;
    if (active.value && timeout === null) arm(remainingMs ?? seconds.value * 1000);
  }

  function onPlaybackPaused() {
    playing.value = false;
    if (timeout === null) return;
    remainingMs = Math.max(0, armedMs - (Date.now() - armedAt));
    stop();
  }

  watch(presentationKey, () => {
    stop();
    remainingMs = null;
    playing.value = false;
  });

  // A changed length or Autoplay switch applies cleanly: a countdown already
  // running restarts at the new length.
  watch([seconds, enabled], () => {
    stop();
    remainingMs = null;
    if (playing.value && active.value) arm(seconds.value * 1000);
  });

  onMounted(() => {
    try {
      seconds.value = parsePlayLength(localStorage.getItem(STORAGE_KEY));
    } catch {
      // Storage can be unavailable; the full song still plays for this visit.
    }
  });

  watch(seconds, (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Keep the current session usable when persistence is blocked.
    }
  });

  onScopeDispose(stop);

  // Whole seconds until the song moves on; null when no play length applies.
  const remainingSeconds = computed<number | null>(() => {
    void tick.value;
    if (!active.value) return null;
    const ms = timeout !== null ? armedMs - (Date.now() - armedAt) : (remainingMs ?? seconds.value * 1000);
    return Math.max(0, Math.ceil(ms / 1000));
  });

  return { seconds, remainingSeconds, onPlaybackStarted, onPlaybackPaused };
}
