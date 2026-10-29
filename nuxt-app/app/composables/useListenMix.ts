import { onMounted, readonly, ref } from "vue";
import { LISTEN_MIX_STORAGE_KEY, parseListenMixPreference } from "../utils/listenMix";

export function useListenMix() {
  const enabled = ref(false);

  onMounted(() => {
    try {
      enabled.value = parseListenMixPreference(window.localStorage.getItem(LISTEN_MIX_STORAGE_KEY));
    } catch {
      // Storage can be unavailable; Mix stays off for this visit.
    }
  });

  function setEnabled(value: boolean) {
    enabled.value = value;
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LISTEN_MIX_STORAGE_KEY, value ? "1" : "0");
      }
    } catch {
      // The session choice still applies when storage is blocked.
    }
  }

  function toggle() {
    setEnabled(!enabled.value);
  }

  return { enabled: readonly(enabled), setEnabled, toggle };
}
