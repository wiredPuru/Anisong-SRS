/** Browser full screen for the party display, which hides every bit of browser UI. */
export function usePartyFullscreen() {
  const isFullscreen = ref(false);

  function sync() {
    isFullscreen.value = Boolean(document.fullscreenElement);
  }

  // Browsers only grant full screen from a click or key press, and refuse it
  // outright in an OBS browser source or an iframe; either way the display
  // keeps working in its window, so a refusal is ignored.
  async function enter() {
    if (document.fullscreenElement || !document.fullscreenEnabled) return;
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    } catch {
      sync();
    }
  }

  async function toggle() {
    if (!document.fullscreenElement) return enter();
    try {
      await document.exitFullscreen();
    } catch {
      sync();
    }
  }

  onMounted(() => {
    sync();
    document.addEventListener("fullscreenchange", sync);
  });
  onBeforeUnmount(() => document.removeEventListener("fullscreenchange", sync));

  return { isFullscreen, enter, toggle };
}
