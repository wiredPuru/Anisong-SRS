import { onMounted, readonly, ref } from "vue";
import type { GainCurve } from "../utils/mediaGain";
import {
  LISTEN_MIX_CURVE_STORAGE_KEY,
  LISTEN_MIX_LENGTH_STORAGE_KEY,
  LISTEN_MIX_SECONDS,
  LISTEN_MIX_STORAGE_KEY,
  parseListenMixCurve,
  parseListenMixLength,
  parseListenMixPreference,
} from "../utils/listenMix";

export function useListenMix() {
  const enabled = ref(false);
  const seconds = ref<number>(LISTEN_MIX_SECONDS);
  const curve = ref<GainCurve>("linear");

  onMounted(() => {
    try {
      enabled.value = parseListenMixPreference(window.localStorage.getItem(LISTEN_MIX_STORAGE_KEY));
      seconds.value = parseListenMixLength(window.localStorage.getItem(LISTEN_MIX_LENGTH_STORAGE_KEY));
      curve.value = parseListenMixCurve(window.localStorage.getItem(LISTEN_MIX_CURVE_STORAGE_KEY));
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

  function setSeconds(value: number) {
    seconds.value = parseListenMixLength(String(value));
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LISTEN_MIX_LENGTH_STORAGE_KEY, String(seconds.value));
      }
    } catch {
      // The session choice still applies when storage is blocked.
    }
  }

  function setCurve(value: string) {
    curve.value = parseListenMixCurve(value);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LISTEN_MIX_CURVE_STORAGE_KEY, curve.value);
      }
    } catch {
      // The session choice still applies when storage is blocked.
    }
  }

  function toggle() {
    setEnabled(!enabled.value);
  }

  return { enabled: readonly(enabled), seconds: readonly(seconds), curve: readonly(curve), setEnabled, setSeconds, setCurve, toggle };
}
