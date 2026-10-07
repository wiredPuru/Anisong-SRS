const MODE_STORAGE_KEY = "gaqSrs:autoRevealMode";
const SECONDS_STORAGE_KEY = "gaqSrs:autoRevealSeconds";
// Well under a second so a resume never shows a stale number for long.
const DISPLAY_TICK_MS = 250;

// /listen's Auto Reveal: counts down only while the clip plays, then lifts the
// veil for that one song. The mode and seconds are shared with /study's stored
// settings on purpose; the timer itself is deliberately separate from Study's.
export function useListenAutoReveal(revealed: Ref<boolean>, presentationKey: Ref<number>, onExpire: () => void) {
  const mode = ref<AutoRevealMode>("off");
  const seconds = ref(AUTO_REVEAL_SECONDS_DEFAULT);
  const targets = computed(() => revealTargets(mode.value));

  const started = ref(false);
  const playing = ref(false);
  const displaySeconds = ref(AUTO_REVEAL_SECONDS_DEFAULT);
  const countdownActive = computed(() => canAutoReveal(mode.value, started.value, revealed.value, true));

  let timeout: ReturnType<typeof setTimeout> | null = null;
  let tick: ReturnType<typeof setInterval> | null = null;
  let armedAt = 0;
  let armedMs = 0;
  // Time left when a running countdown was paused; null means none is paused.
  let remainingMs: number | null = null;

  function syncDisplay() {
    if (timeout !== null) displaySeconds.value = remainingRevealSeconds(armedMs, Date.now() - armedAt);
    else if (remainingMs !== null) displaySeconds.value = remainingRevealSeconds(remainingMs);
    else displaySeconds.value = seconds.value;
  }

  function stop() {
    if (timeout !== null) clearTimeout(timeout);
    if (tick !== null) clearInterval(tick);
    timeout = null;
    tick = null;
  }

  function start(durationMs: number) {
    stop();
    armedAt = Date.now();
    armedMs = durationMs;
    timeout = setTimeout(() => {
      stop();
      remainingMs = null;
      onExpire();
    }, durationMs);
    tick = setInterval(syncDisplay, DISPLAY_TICK_MS);
    syncDisplay();
  }

  function startOrResume() {
    if (countdownActive.value) start(remainingMs ?? seconds.value * 1000);
  }

  function onPlaybackStarted() {
    started.value = true;
    playing.value = true;
    startOrResume();
  }

  function onPlaybackPaused() {
    playing.value = false;
    if (timeout === null) return;
    remainingMs = Math.max(0, armedMs - (Date.now() - armedAt));
    stop();
    syncDisplay();
  }

  function reset() {
    stop();
    remainingMs = null;
    started.value = false;
    playing.value = false;
    syncDisplay();
  }

  // A new song, or a reveal of this one, ends any pending countdown.
  watch(presentationKey, reset);
  watch(revealed, (value) => {
    if (!value) return;
    stop();
    remainingMs = null;
  });

  // A changed mode or length applies cleanly: it never re-hides a revealed
  // song, and a countdown already running restarts at the new length.
  watch([mode, seconds], () => {
    stop();
    remainingMs = null;
    syncDisplay();
    if (playing.value) startOrResume();
  });

  onMounted(() => {
    try {
      const storedMode = localStorage.getItem(MODE_STORAGE_KEY);
      mode.value = isAutoRevealMode(storedMode) ? storedMode : "off";
      const storedSeconds = localStorage.getItem(SECONDS_STORAGE_KEY);
      seconds.value = storedSeconds !== null ? clampRevealSeconds(Number(storedSeconds)) : AUTO_REVEAL_SECONDS_DEFAULT;
    } catch {
      // Storage can be unavailable; the defaults still work for this visit.
    }
  });

  watch(mode, (value) => {
    try {
      localStorage.setItem(MODE_STORAGE_KEY, value);
    } catch {
      // Keep the current session usable when persistence is blocked.
    }
  });
  watch(seconds, (value) => {
    try {
      localStorage.setItem(SECONDS_STORAGE_KEY, String(value));
    } catch {
      // Keep the current session usable when persistence is blocked.
    }
  });

  onUnmounted(stop);

  return {
    mode,
    seconds,
    targets,
    countdownActive,
    displaySeconds,
    onPlaybackStarted,
    onPlaybackPaused,
    setSeconds: (value: number) => {
      seconds.value = clampRevealSeconds(value);
    },
  };
}
